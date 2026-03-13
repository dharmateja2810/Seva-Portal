import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../db/pool';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/masters/tehsils
router.get('/tehsils', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await query(`SELECT id, name, district FROM tehsils WHERE is_active = TRUE ORDER BY name`);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/masters/categories
router.get('/categories', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await query(
      `SELECT id, name, module, sla_days FROM complaint_categories WHERE is_active = TRUE AND module = 'phed' ORDER BY name`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/masters/users  (for assign dropdown — operators/staff)
router.get('/users', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await query(
      `SELECT id, full_name, role, email FROM users
       WHERE is_active = TRUE AND role IN ('phed_operator','phed_nodal','phed_admin')
       ORDER BY full_name`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

export default router;
