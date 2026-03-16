import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../db/pool';
import { authenticate, authorize } from '../middleware/auth';
import { auditLog } from '../middleware/audit';

const router = Router();

// All admin routes require auth + admin role
router.use(authenticate);
router.use(authorize('system_admin', 'phed_admin'));

// ── Validation ──────────────────────────────────────────────────
const createUserSchema = z.object({
  username:    z.string().min(3).max(100),
  fullName:    z.string().min(2).max(200),
  email:       z.string().email().optional().or(z.literal('')),
  mobile:      z.string().min(7).max(20).optional().or(z.literal('')),
  department:  z.string().max(100).optional().or(z.literal('')),
  designation: z.string().max(200).optional().or(z.literal('')),
  role:        z.enum(['system_admin', 'phed_admin', 'phed_updater', 'dc_viewer']),
  isActive:    z.boolean().default(true),
  password:    z.string().min(8).optional(),
});

// ── GET /api/admin/users ────────────────────────────────────────
router.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search } = req.query as { search?: string };
    const params: unknown[] = [];
    let sql = `
      SELECT id, username, full_name, email, role, department, designation,
             is_active, last_login_at, created_at
      FROM users`;

    if (search) {
      sql += ` WHERE full_name ILIKE $1 OR username ILIKE $1 OR email ILIKE $1`;
      params.push(`%${search}%`);
    }
    sql += ` ORDER BY created_at DESC`;

    const rows = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ── GET /api/admin/users/:id ────────────────────────────────────
router.get('/users/:id', async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ success: false, message: 'Invalid ID' }); return; }

    const [user] = await query(
      `SELECT id, username, full_name, email, role, department, designation, is_active
       FROM users WHERE id = $1`,
      [id]
    );
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

// ── POST /api/admin/users ───────────────────────────────────────
router.post('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createUserSchema.parse(req.body);
    const password = body.password || 'Admin@123';
    const hash = await bcrypt.hash(password, 12);
    const moduleAccess = body.role === 'dc_viewer' ? '{phed,dc}' : '{phed}';

    const [user] = await query(
      `INSERT INTO users
         (username, full_name, email, mobile_enc, role, module_access,
          department, designation, password_hash, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, username, full_name, role, department, is_active`,
      [
        body.username, body.fullName, body.email || null, body.mobile || null,
        body.role, moduleAccess, body.department || null, body.designation || null,
        hash, body.isActive,
      ]
    );

    await auditLog(req.user!.userId, 'CREATE_USER', 'user', user.id as number, req);
    res.status(201).json({ success: true, data: user });
  } catch (err) { next(err); }
});

// ── PATCH /api/admin/users/:id ──────────────────────────────────
router.patch('/users/:id', async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ success: false, message: 'Invalid ID' }); return; }

    const body = createUserSchema.partial().parse(req.body);
    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (body.fullName    !== undefined) { updates.push(`full_name = $${idx++}`);    params.push(body.fullName); }
    if (body.email       !== undefined) { updates.push(`email = $${idx++}`);         params.push(body.email || null); }
    if (body.department  !== undefined) { updates.push(`department = $${idx++}`);    params.push(body.department || null); }
    if (body.designation !== undefined) { updates.push(`designation = $${idx++}`);   params.push(body.designation || null); }
    if (body.role        !== undefined) { updates.push(`role = $${idx++}`);          params.push(body.role); }
    if (body.isActive    !== undefined) { updates.push(`is_active = $${idx++}`);     params.push(body.isActive); }
    if (body.password)                  {
      const hash = await bcrypt.hash(body.password, 12);
      updates.push(`password_hash = $${idx++}`);
      params.push(hash);
    }

    if (!updates.length) { res.status(400).json({ success: false, message: 'No fields to update' }); return; }

    updates.push('updated_at = NOW()');
    params.push(id);

    const [user] = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}
       RETURNING id, username, full_name, role, department, is_active`,
      params
    );

    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }

    await auditLog(req.user!.userId, 'UPDATE_USER', 'user', id, req);
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

export default router;
