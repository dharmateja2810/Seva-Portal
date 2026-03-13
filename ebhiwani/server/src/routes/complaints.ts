import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/pool';
import { authenticate, authorize } from '../middleware/auth';
import { auditLog } from '../middleware/audit';

const router = Router();

// All complaint routes require authentication
router.use(authenticate);

// ── Validation ──────────────────────────────────────────────────
const createComplaintSchema = z.object({
  source: z.string().min(1).max(50),
  tehsilId: z.number().int().positive(),
  location: z.string().min(1).max(500),
  categoryId: z.number().int().positive(),
  description: z.string().max(2000).optional(),
  complainantName: z.string().min(1).max(200),
  complainantPhone: z.string().min(7).max(20),
});

const updateStatusSchema = z.object({
  status: z.enum(['New', 'Pending', 'In Progress', 'Resolved', 'Closed']),
  notes: z.string().max(1000).optional(),
  resolutionSummary: z.string().max(2000).optional(),
});

const assignSchema = z.object({
  assignedTo: z.number().int().positive(),
  dueDate: z.string().optional(),
  comments: z.string().max(500).optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.string().optional(),
  tehsilId: z.coerce.number().int().optional(),
  categoryId: z.coerce.number().int().optional(),
  search: z.string().max(200).optional(),
  sortBy: z.enum(['created_at', 'complaint_number', 'status', 'updated_at']).default('created_at'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

// PII encryption/decryption helper (uses pgcrypto symmetric encryption)
// Key is stored in DB as a session-level GUC to keep it server-side
const ENC_KEY = process.env.PII_ENCRYPTION_KEY || 'ebhiwani-pii-key-32chars-change!';

function encryptExpr(field: string): string {
  // pgp_sym_encrypt(value, key) returns bytea, cast to text
  return `pgp_sym_encrypt(${field}, '${ENC_KEY}')`;
}

function decryptExpr(field: string): string {
  return `pgp_sym_decrypt(${field}::bytea, '${ENC_KEY}')`;
}

// ── GET /api/complaints ─────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = listQuerySchema.parse(req.query);
    const offset = (q.page - 1) * q.limit;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (q.status) {
      conditions.push(`c.status = $${idx++}`);
      params.push(q.status);
    }
    if (q.tehsilId) {
      conditions.push(`c.tehsil_id = $${idx++}`);
      params.push(q.tehsilId);
    }
    if (q.categoryId) {
      conditions.push(`c.category_id = $${idx++}`);
      params.push(q.categoryId);
    }
    if (q.search) {
      conditions.push(`(c.location ILIKE $${idx} OR CAST(c.complaint_number AS TEXT) ILIKE $${idx})`);
      params.push(`%${q.search}%`);
      idx++;
    }

    // DC monitors see all; operators see only their assignments or created
    if (req.user!.role === 'phed_operator') {
      conditions.push(`(c.assigned_to = $${idx} OR c.created_by = $${idx})`);
      params.push(req.user!.userId);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query<{ total: string }>(
      `SELECT COUNT(*) as total FROM complaints c ${where}`,
      params
    );
    const total = parseInt(countResult[0]?.total ?? '0', 10);

    const rows = await query(
      `SELECT
         c.id, c.complaint_number, c.source, c.status, c.location, c.due_date,
         c.created_at, c.updated_at,
         t.name AS tehsil_name,
         cc.name AS category_name,
         ${decryptExpr('c.complainant_name_enc')} AS complainant_name,
         u.full_name AS assigned_to_name
       FROM complaints c
       JOIN tehsils t ON t.id = c.tehsil_id
       JOIN complaint_categories cc ON cc.id = c.category_id
       LEFT JOIN users u ON u.id = c.assigned_to
       ${where}
       ORDER BY c.${q.sortBy} ${q.sortDir}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, q.limit, offset]
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: q.page,
        limit: q.limit,
        total,
        totalPages: Math.ceil(total / q.limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/complaints/:id ─────────────────────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params['id'] ?? ''), 10);
    if (isNaN(id)) {
      next(); // not a numeric id – pass to later named routes (e.g. /report)
      return;
    }

    const [complaint] = await query(
      `SELECT
         c.*,
         t.name AS tehsil_name,
         cc.name AS category_name,
         cc.sla_days,
         ${decryptExpr('c.complainant_name_enc')} AS complainant_name,
         ${decryptExpr('c.complainant_phone_enc')} AS complainant_phone,
         u.full_name AS assigned_to_name,
         cb.full_name AS created_by_name
       FROM complaints c
       JOIN tehsils t ON t.id = c.tehsil_id
       JOIN complaint_categories cc ON cc.id = c.category_id
       LEFT JOIN users u ON u.id = c.assigned_to
       LEFT JOIN users cb ON cb.id = c.created_by
       WHERE c.id = $1`,
      [id]
    );

    if (!complaint) {
      res.status(404).json({ success: false, message: 'Complaint not found' });
      return;
    }

    // Status history
    const history = await query(
      `SELECT sh.*, u.full_name AS updated_by_name
       FROM status_history sh
       LEFT JOIN users u ON u.id = sh.updated_by
       WHERE sh.complaint_id = $1
       ORDER BY sh.created_at ASC`,
      [id]
    );

    // Attachments
    const attachments = await query(
      `SELECT id, original_name, mime_type, size_bytes, created_at
       FROM attachments WHERE complaint_id = $1 ORDER BY created_at ASC`,
      [id]
    );

    res.json({ success: true, data: { ...complaint, history, attachments } });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/complaints ────────────────────────────────────────
router.post(
  '/',
  authorize('phed_admin', 'phed_nodal', 'phed_operator'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createComplaintSchema.parse(req.body);

      // Get SLA for due date
      const [cat] = await query<{ sla_days: number }>(
        `SELECT sla_days FROM complaint_categories WHERE id = $1`,
        [body.categoryId]
      );
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (cat?.sla_days ?? 5));

      const complaintNumber = await query<{ nextval: string }>(
        `SELECT nextval('complaint_number_seq')`
      );
      const num = parseInt(complaintNumber[0]?.nextval ?? '100001', 10);

      const [created] = await query(
        `INSERT INTO complaints (
           complaint_number, source, tehsil_id, location, category_id, description,
           complainant_name_enc, complainant_phone_enc, status, created_by, due_date
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           ${encryptExpr('$7')},
           ${encryptExpr('$8')},
           'New', $9, $10
         ) RETURNING id, complaint_number, status, created_at`,
        [
          num, body.source, body.tehsilId, body.location, body.categoryId,
          body.description ?? null, body.complainantName, body.complainantPhone,
          req.user!.userId, dueDate.toISOString().split('T')[0],
        ]
      );

      // Record initial status
      await query(
        `INSERT INTO status_history (complaint_id, from_status, to_status, updated_by, notes)
         VALUES ($1, NULL, 'New', $2, 'Complaint registered')`,
        [created.id, req.user!.userId]
      );

      await auditLog(req.user!.userId, 'CREATE_COMPLAINT', 'complaint', created.id as number, req, { complaintNumber: num });

      res.status(201).json({ success: true, data: created });
    } catch (err) {
      next(err);
    }
  }
);

// ── PATCH /api/complaints/:id/status ───────────────────────────
router.patch(
  '/:id/status',
  authorize('phed_admin', 'phed_nodal', 'phed_operator'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(String(req.params['id'] ?? ''), 10);
      const body = updateStatusSchema.parse(req.body);

      const [existing] = await query<{ id: number; status: string }>(
        `SELECT id, status FROM complaints WHERE id = $1`,
        [id]
      );

      if (!existing) {
        res.status(404).json({ success: false, message: 'Complaint not found' });
        return;
      }

      const updates: Record<string, unknown> = { status: body.status, updated_at: new Date() };
      if (body.status === 'Closed' || body.status === 'Resolved') {
        updates.closed_at = new Date();
        if (body.resolutionSummary) updates.resolution_summary = body.resolutionSummary;
      }

      await query(
        `UPDATE complaints SET status = $1, updated_at = NOW(),
         closed_at = $2, resolution_summary = COALESCE($3, resolution_summary)
         WHERE id = $4`,
        [body.status, updates.closed_at ?? null, body.resolutionSummary ?? null, id]
      );

      await query(
        `INSERT INTO status_history (complaint_id, from_status, to_status, updated_by, notes)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, existing.status, body.status, req.user!.userId, body.notes ?? null]
      );

      await auditLog(req.user!.userId, 'UPDATE_STATUS', 'complaint', id, req, {
        from: existing.status,
        to: body.status,
      });

      res.json({ success: true, message: 'Status updated' });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/complaints/:id/assign ────────────────────────────
router.post(
  '/:id/assign',
  authorize('phed_admin', 'phed_nodal'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(String(req.params['id'] ?? ''), 10);
      const body = assignSchema.parse(req.body);

      const [existing] = await query<{ id: number }>(
        `SELECT id FROM complaints WHERE id = $1`,
        [id]
      );
      if (!existing) {
        res.status(404).json({ success: false, message: 'Complaint not found' });
        return;
      }

      await query(
        `UPDATE complaints SET assigned_to = $1, due_date = COALESCE($2, due_date),
         status = CASE WHEN status = 'New' THEN 'Pending' ELSE status END,
         updated_at = NOW()
         WHERE id = $3`,
        [body.assignedTo, body.dueDate ?? null, id]
      );

      await query(
        `INSERT INTO assignments (complaint_id, assigned_to, assigned_by, due_date, comments)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, body.assignedTo, req.user!.userId, body.dueDate ?? null, body.comments ?? null]
      );

      await auditLog(req.user!.userId, 'ASSIGN_COMPLAINT', 'complaint', id, req, {
        assignedTo: body.assignedTo,
      });

      res.json({ success: true, message: 'Complaint assigned' });
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/complaints/dashboard/stats ────────────────────────
// Query params:
//   range  = 7d | 30d | 3m | 6m | ytd | 1y | custom  (default: 7d)
//   from   = YYYY-MM-DD  (only used when range=custom)
//   to     = YYYY-MM-DD  (only used when range=custom)
router.get('/dashboard/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // ── Resolve date range ─────────────────────────────────────
    const rangeParam = (req.query.range as string) ?? '7d';
    const customFrom = req.query.from as string | undefined;
    const customTo   = req.query.to   as string | undefined;

    const today    = new Date();
    const todayStr = today.toISOString().split('T')[0];

    let startStr: string;
    let endStr  : string = todayStr;
    let groupBy : 'day' | 'month' = 'day';

    switch (rangeParam) {
      case '30d':
        startStr = new Date(today.getTime() - 30 * 86_400_000).toISOString().split('T')[0];
        break;
      case '3m':
        startStr = new Date(today.getTime() - 90 * 86_400_000).toISOString().split('T')[0];
        groupBy  = 'month';
        break;
      case '6m':
        startStr = new Date(today.getTime() - 180 * 86_400_000).toISOString().split('T')[0];
        groupBy  = 'month';
        break;
      case 'ytd':
        startStr = `${today.getFullYear()}-01-01`;
        groupBy  = 'month';
        break;
      case '1y':
        startStr = new Date(today.getTime() - 365 * 86_400_000).toISOString().split('T')[0];
        groupBy  = 'month';
        break;
      case 'custom':
        startStr = customFrom ?? new Date(today.getTime() - 30 * 86_400_000).toISOString().split('T')[0];
        endStr   = customTo   ?? todayStr;
        groupBy  = (new Date(endStr).getTime() - new Date(startStr).getTime()) / 86_400_000 > 60
          ? 'month'
          : 'day';
        break;
      default: // '7d'
        startStr = new Date(today.getTime() - 7 * 86_400_000).toISOString().split('T')[0];
    }

    // ── KPI stats (always all-time snapshot) ──────────────────
    const [stats] = await query(
      `SELECT
         COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) AS new_today,
         COUNT(*) FILTER (WHERE status = 'Pending') AS pending,
         COUNT(*) FILTER (WHERE status = 'In Progress') AS in_progress,
         COUNT(*) FILTER (WHERE status = 'Closed' AND DATE(updated_at) = CURRENT_DATE) AS closed_today,
         COUNT(*) FILTER (WHERE status NOT IN ('Closed','Resolved')) AS total_open
       FROM complaints`
    );

    // ── Trend: day-bucket or month-bucket ─────────────────────
    const trendSql = groupBy === 'month'
      ? `SELECT
           TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS period,
           COUNT(*) FILTER (WHERE status = 'New')                    AS new_count,
           COUNT(*) FILTER (WHERE status = 'Pending')                AS pending_count,
           COUNT(*) FILTER (WHERE status = 'In Progress')            AS in_progress_count,
           COUNT(*) FILTER (WHERE status IN ('Resolved','Closed'))   AS resolved_count
         FROM complaints
         WHERE created_at >= $1::date
           AND created_at <  $2::date + INTERVAL '1 day'
         GROUP BY DATE_TRUNC('month', created_at)
         ORDER BY period ASC`
      : `SELECT
           DATE(created_at)::text AS period,
           COUNT(*) FILTER (WHERE status = 'New')                    AS new_count,
           COUNT(*) FILTER (WHERE status = 'Pending')                AS pending_count,
           COUNT(*) FILTER (WHERE status = 'In Progress')            AS in_progress_count,
           COUNT(*) FILTER (WHERE status IN ('Resolved','Closed'))   AS resolved_count
         FROM complaints
         WHERE created_at >= $1::date
           AND created_at <  $2::date + INTERVAL '1 day'
         GROUP BY DATE(created_at)
         ORDER BY period ASC`;

    const trendData = await query(trendSql, [startStr, endStr]);

    // ── Complaints by tehsil (within range) ───────────────────
    const byTehsil = await query(
      `SELECT t.name AS tehsil, COUNT(*) AS total
       FROM complaints c JOIN tehsils t ON t.id = c.tehsil_id
       WHERE c.created_at >= $1::date AND c.created_at < $2::date + INTERVAL '1 day'
       GROUP BY t.name ORDER BY total DESC`,
      [startStr, endStr]
    );

    // ── Complaints by category (within range) ─────────────────
    const byCategory = await query(
      `SELECT cc.name AS category, COUNT(*) AS total
       FROM complaints c JOIN complaint_categories cc ON cc.id = c.category_id
       WHERE c.created_at >= $1::date AND c.created_at < $2::date + INTERVAL '1 day'
       GROUP BY cc.name ORDER BY total DESC`,
      [startStr, endStr]
    );

    // ── Officer workload (open complaints, range-independent) ─
    const officerWorkload = await query(
      `SELECT u.full_name, COUNT(c.id) AS complaint_count
       FROM complaints c JOIN users u ON u.id = c.assigned_to
       WHERE c.status NOT IN ('Closed', 'Resolved')
       GROUP BY u.full_name ORDER BY complaint_count DESC LIMIT 10`
    );

    res.json({
      success: true,
      data: {
        stats,
        trendData,
        groupBy,
        rangeMeta: { range: rangeParam, from: startStr, to: endStr },
        byTehsil,
        byCategory,
        officerWorkload,
        weeklyTrend: trendData, // backward-compat alias
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/complaints/report ──────────────────────────────────
// Full filtered list for the Reports page (up to 1000 rows)
// Query params: same as list + from/to date range
router.get('/report', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      status, tehsilId, categoryId, search,
      from, to,
      sortBy = 'created_at', sortDir = 'desc',
    } = req.query as Record<string, string | undefined>;

    const conditions: string[] = [];
    const params: unknown[]    = [];
    let idx = 1;

    if (status)     { conditions.push(`c.status = $${idx++}`);        params.push(status); }
    if (tehsilId)   { conditions.push(`c.tehsil_id = $${idx++}`);     params.push(Number(tehsilId)); }
    if (categoryId) { conditions.push(`c.category_id = $${idx++}`);   params.push(Number(categoryId)); }
    if (search)     {
      conditions.push(`(c.location ILIKE $${idx} OR CAST(c.complaint_number AS TEXT) ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    if (from) { conditions.push(`DATE(c.created_at) >= $${idx++}`); params.push(from); }
    if (to)   { conditions.push(`DATE(c.created_at) <= $${idx++}`); params.push(to); }

    // Operators see only their own
    if (req.user!.role === 'phed_operator') {
      conditions.push(`(c.assigned_to = $${idx} OR c.created_by = $${idx})`);
      params.push(req.user!.userId);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const allowed = ['created_at', 'complaint_number', 'status', 'updated_at'];
    const safeSort = allowed.includes(sortBy) ? sortBy : 'created_at';
    const safeDir  = sortDir === 'asc' ? 'ASC' : 'DESC';

    const rows = await query(
      `SELECT
         c.id,
         c.complaint_number,
         c.status,
         c.source,
         c.location,
         c.due_date,
         c.created_at,
         c.updated_at,
         t.name  AS tehsil_name,
         cc.name AS category_name,
         ${decryptExpr('c.complainant_name_enc')} AS complainant_name,
         u.full_name AS assigned_to_name,
         EXTRACT(DAY FROM NOW() - c.created_at)::int AS days_open
       FROM complaints c
       JOIN tehsils t             ON t.id  = c.tehsil_id
       JOIN complaint_categories cc ON cc.id = c.category_id
       LEFT JOIN users u          ON u.id  = c.assigned_to
       ${where}
       ORDER BY c.${safeSort} ${safeDir}
       LIMIT 1000`,
      params
    );

    res.json({ success: true, data: rows, total: rows.length });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/complaints/report/summary ─────────────────────────
// Aggregated summary stats for the Reports page KPI strip
router.get('/report/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { from, to, tehsilId, categoryId, status } = req.query as Record<string, string | undefined>;

    // Build conditions with c. prefix (safe for JOINed queries)
    const conds: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (status)     { conds.push(`c.status = $${idx++}`);               params.push(status); }
    if (tehsilId)   { conds.push(`c.tehsil_id = $${idx++}`);            params.push(Number(tehsilId)); }
    if (categoryId) { conds.push(`c.category_id = $${idx++}`);          params.push(Number(categoryId)); }
    if (from)       { conds.push(`DATE(c.created_at) >= $${idx++}`);    params.push(from); }
    if (to)         { conds.push(`DATE(c.created_at) <= $${idx++}`);    params.push(to); }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const [summary] = await query(
      `SELECT
         COUNT(*)                                                       AS total,
         COUNT(*) FILTER (WHERE c.status = 'New')                      AS new_count,
         COUNT(*) FILTER (WHERE c.status = 'Pending')                  AS pending,
         COUNT(*) FILTER (WHERE c.status = 'In Progress')              AS in_progress,
         COUNT(*) FILTER (WHERE c.status IN ('Resolved','Closed'))     AS resolved,
         COUNT(*) FILTER (WHERE c.due_date < NOW()
           AND c.status NOT IN ('Resolved','Closed'))                  AS overdue,
         ROUND(AVG(EXTRACT(DAY FROM
           CASE WHEN c.status IN ('Resolved','Closed')
             THEN c.updated_at ELSE NOW() END - c.created_at
         ))::numeric, 1)                                               AS avg_resolution_days
       FROM complaints c ${where}`,
      params
    );

    const byStatus = await query(
      `SELECT c.status, COUNT(*) AS total
       FROM complaints c ${where}
       GROUP BY c.status ORDER BY total DESC`,
      params
    );

    const byTehsil = await query(
      `SELECT t.name AS tehsil, COUNT(*) AS total
       FROM complaints c JOIN tehsils t ON t.id = c.tehsil_id
       ${where}
       GROUP BY t.name ORDER BY total DESC LIMIT 8`,
      params
    );

    res.json({ success: true, data: { summary, byStatus, byTehsil } });
  } catch (err) {
    next(err);
  }
});

export default router;
