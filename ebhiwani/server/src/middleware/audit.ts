import { Request, Response, NextFunction } from 'express';
import { query } from '../db/pool';
import { logger } from '../utils/logger';

export async function auditLog(
  userId: number | undefined,
  action: string,
  entityType: string,
  entityId: string | number,
  req: Request,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip_address, user_agent, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId ?? null,
        action,
        entityType,
        String(entityId),
        req.ip,
        req.headers['user-agent'] ?? null,
        details ? JSON.stringify(details) : null,
      ]
    );
  } catch (err) {
    logger.error('Failed to write audit log', { error: (err as Error).message });
  }
}

/**
 * Middleware to log all requests (summary)
 */
export function requestLogger(req: Request, _res: Response, next: NextFunction): void {
  logger.debug(`${req.method} ${req.path}`, {
    ip: req.ip,
    user: req.user?.username,
  });
  next();
}
