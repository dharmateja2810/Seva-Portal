import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface JwtPayload {
  userId: number;
  username: string;
  role: string;
  moduleAccess: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    res.status(401).json({ success: false, message: 'No token provided' });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret) as JwtPayload;
    req.user = decoded;
    next();
  } catch (err) {
    logger.warn('Invalid token attempt', { error: (err as Error).message });
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

/**
 * Authorize by role(s)
 */
export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }
    if (roles.length && !roles.includes(req.user.role)) {
      logger.warn('Unauthorized access attempt', {
        user: req.user.username,
        role: req.user.role,
        required: roles,
      });
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

/**
 * Authorize by module access
 */
export function requireModule(module: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }
    if (!req.user.moduleAccess.includes(module)) {
      res.status(403).json({ success: false, message: 'Module access denied' });
      return;
    }
    next();
  };
}
