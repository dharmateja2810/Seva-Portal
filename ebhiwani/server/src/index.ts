import app from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { pool } from './db/pool';
import { startScheduler } from './services/scheduler';
import { runMigrations } from './db/migrate';

const PORT = config.server.port;

async function start() {
  try {
    // Verify DB connection
    await pool.query('SELECT 1');
    logger.info('Database connection verified');

    // Run database migrations (idempotent — safe to run every boot)
    await runMigrations();
    logger.info('Database migrations completed');

    // Start background scheduler
    startScheduler();

    const server = app.listen(PORT, () => {
      logger.info(`eBhiwani API server running`, {
        port: PORT,
        env: config.server.nodeEnv,
      });
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received — shutting down gracefully`);
      server.close(async () => {
        await pool.end();
        logger.info('Server and DB pool closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.error('Failed to start server', { error: (err as Error).message });
    process.exit(1);
  }
}

start();
