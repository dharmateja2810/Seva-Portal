import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config';
import { query } from '../db/pool';
import { authenticate, JwtPayload } from '../middleware/auth';
import { auditLog } from '../middleware/audit';
import { logger } from '../utils/logger';

const router = Router();

// ── Validation schemas ──────────────────────────────────────────
const loginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number')
    .regex(/[^A-Za-z0-9]/, 'Must contain a special character'),
});

interface UserRow {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role: string;
  module_access: string[];
  password_hash: string;
  is_active: boolean;
}

function generateTokens(user: UserRow) {
  const payload: JwtPayload = {
    userId: user.id,
    username: user.username,
    role: user.role,
    moduleAccess: user.module_access,
  };

  const accessToken = jwt.sign(payload, config.auth.jwtSecret, {
    expiresIn: config.auth.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });

  const refreshToken = jwt.sign(
    { userId: user.id },
    config.auth.refreshSecret,
    { expiresIn: config.auth.refreshExpiresIn as jwt.SignOptions['expiresIn'] }
  );

  return { accessToken, refreshToken };
}

// ── POST /api/auth/login ────────────────────────────────────────
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = loginSchema.parse(req.body);

    const [user] = await query<UserRow>(
      `SELECT id, username, full_name, email, role, module_access, password_hash, is_active
       FROM users WHERE username = $1`,
      [username]
    );

    if (!user || !user.is_active) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      logger.warn('Failed login attempt', { username, ip: req.ip });
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    const { accessToken, refreshToken } = generateTokens(user);

    // Store hashed refresh token
    const refreshHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [user.id, refreshHash, expiresAt]
    );

    // Update last login
    await query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [user.id]);

    await auditLog(user.id, 'LOGIN', 'user', user.id, req);

    res.json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        moduleAccess: user.module_access,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/refresh ──────────────────────────────────────
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) {
      res.status(401).json({ success: false, message: 'No refresh token' });
      return;
    }

    let decoded: { userId: number };
    try {
      decoded = jwt.verify(refreshToken, config.auth.refreshSecret) as { userId: number };
    } catch {
      res.status(401).json({ success: false, message: 'Invalid refresh token' });
      return;
    }

    const tokens = await query<{ id: number; token_hash: string; expires_at: string }>(
      `SELECT id, token_hash, expires_at FROM refresh_tokens
       WHERE user_id = $1 AND expires_at > NOW()`,
      [decoded.userId]
    );

    let matched = false;
    for (const t of tokens) {
      if (await bcrypt.compare(refreshToken, t.token_hash)) {
        matched = true;
        // Rotate: delete old, issue new
        await query(`DELETE FROM refresh_tokens WHERE id = $1`, [t.id]);
        break;
      }
    }

    if (!matched) {
      res.status(401).json({ success: false, message: 'Invalid refresh token' });
      return;
    }

    const [user] = await query<UserRow>(
      `SELECT id, username, full_name, email, role, module_access, password_hash, is_active
       FROM users WHERE id = $1 AND is_active = TRUE`,
      [decoded.userId]
    );

    if (!user) {
      res.status(401).json({ success: false, message: 'User not found' });
      return;
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);

    const newHash = await bcrypt.hash(newRefreshToken, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [user.id, newHash, expiresAt]
    );

    res.json({ success: true, accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/logout ───────────────────────────────────────
router.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [req.user!.userId]);
    await auditLog(req.user!.userId, 'LOGOUT', 'user', req.user!.userId, req);
    res.json({ success: true, message: 'Logged out' });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/auth/me ────────────────────────────────────────────
router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [user] = await query<Omit<UserRow, 'password_hash'>>(
      `SELECT id, username, full_name, email, role, module_access, is_active, last_login_at
       FROM users WHERE id = $1`,
      [req.user!.userId]
    );
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/change-password ─────────────────────────────
router.post(
  '/change-password',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

      const [user] = await query<UserRow>(
        `SELECT id, password_hash FROM users WHERE id = $1`,
        [req.user!.userId]
      );

      const valid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!valid) {
        res.status(400).json({ success: false, message: 'Current password is incorrect' });
        return;
      }

      const newHash = await bcrypt.hash(newPassword, config.auth.bcryptRounds);
      await query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [
        newHash,
        req.user!.userId,
      ]);

      await auditLog(req.user!.userId, 'CHANGE_PASSWORD', 'user', req.user!.userId, req);
      res.json({ success: true, message: 'Password changed successfully' });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
