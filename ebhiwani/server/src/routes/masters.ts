import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../db/pool';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/masters/tehsils
router.get('/tehsils', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isAdmin = ['system_admin', 'phed_admin'].includes(req.user?.role ?? '');
    const rows = await query(
      `SELECT id, name, district, is_active FROM tehsils
       ${isAdmin ? '' : 'WHERE is_active = TRUE'}
       ORDER BY name`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/masters/tehsils
router.post('/tehsils', authorize('system_admin', 'phed_admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, district = 'Bhiwani' } = req.body as { name: string; district?: string };
    if (!name?.trim()) { res.status(400).json({ success: false, message: 'Name is required' }); return; }
    const [row] = await query(
      `INSERT INTO tehsils (name, district) VALUES ($1, $2) RETURNING id, name, district, is_active`,
      [name.trim(), district]
    );
    res.status(201).json({ success: true, data: row });
  } catch (err) { next(err); }
});

// PATCH /api/masters/tehsils/:id
router.patch('/tehsils/:id', authorize('system_admin', 'phed_admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params['id'] ?? ''), 10);
    const { name, isActive } = req.body as { name?: string; isActive?: boolean };
    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (name     !== undefined) { updates.push(`name = $${idx++}`);      params.push(name); }
    if (isActive !== undefined) { updates.push(`is_active = $${idx++}`); params.push(isActive); }
    if (!updates.length) { res.status(400).json({ success: false, message: 'Nothing to update' }); return; }
    params.push(id);
    const [row] = await query(
      `UPDATE tehsils SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, name, district, is_active`,
      params
    );
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
});

// GET /api/masters/categories
router.get('/categories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isAdmin = ['system_admin', 'phed_admin'].includes(req.user?.role ?? '');
    const rows = await query(
      `SELECT id, name, module, sla_days, is_active FROM complaint_categories
       WHERE module = 'phed' ${isAdmin ? '' : 'AND is_active = TRUE'}
       ORDER BY name`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/masters/categories
router.post('/categories', authorize('system_admin', 'phed_admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, sla_days = 5 } = req.body as { name: string; sla_days?: number };
    if (!name?.trim()) { res.status(400).json({ success: false, message: 'Name is required' }); return; }
    const [row] = await query(
      `INSERT INTO complaint_categories (name, module, sla_days) VALUES ($1, 'phed', $2)
       RETURNING id, name, sla_days, is_active`,
      [name.trim(), sla_days]
    );
    res.status(201).json({ success: true, data: row });
  } catch (err) { next(err); }
});

// PATCH /api/masters/categories/:id
router.patch('/categories/:id', authorize('system_admin', 'phed_admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params['id'] ?? ''), 10);
    const { name, sla_days, isActive } = req.body as { name?: string; sla_days?: number; isActive?: boolean };
    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (name     !== undefined) { updates.push(`name = $${idx++}`);      params.push(name); }
    if (sla_days !== undefined) { updates.push(`sla_days = $${idx++}`);  params.push(sla_days); }
    if (isActive !== undefined) { updates.push(`is_active = $${idx++}`); params.push(isActive); }
    if (!updates.length) { res.status(400).json({ success: false, message: 'Nothing to update' }); return; }
    params.push(id);
    const [row] = await query(
      `UPDATE complaint_categories SET ${updates.join(', ')} WHERE id = $${idx}
       RETURNING id, name, sla_days, is_active`,
      params
    );
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
});

// GET /api/masters/users  (assign dropdown — active staff only)
router.get('/users', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await query(
      `SELECT id, full_name, role, email FROM users
       WHERE is_active = TRUE AND role IN ('phed_updater','phed_admin','system_admin')
       ORDER BY full_name`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

export default router;
