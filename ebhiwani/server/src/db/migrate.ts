/**
 * migrate.ts — Run SQL migration files in order, tracking which have already run.
 * Uses a schema_migrations table so each file runs exactly once.
 */
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const getMigrationPool = () => {
  return new Pool(
    process.env.DATABASE_URL
      ? {
          connectionString: process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false },
        }
      : {
          host: process.env.DB_HOST || 'localhost',
          port: Number(process.env.DB_PORT) || 5432,
          user: process.env.DB_USER || 'postgres',
          password: process.env.DB_PASSWORD || 'postgres',
          database: process.env.DB_NAME || 'ebhiwani',
        }
  );
};

export async function runMigrations() {
  const pool = getMigrationPool();

  // Ensure tracking table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Get already-applied migrations
  const applied = await pool.query<{ filename: string }>(
    `SELECT filename FROM schema_migrations ORDER BY filename`
  );
  const appliedSet = new Set(applied.rows.map(r => r.filename));

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const pending = files.filter(f => !appliedSet.has(f));

  if (pending.length === 0) {
    console.log('All migrations already applied.');
    await pool.end();
    return;
  }

  console.log(`Running ${pending.length} migration(s)...`);

  for (const file of pending) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        `INSERT INTO schema_migrations (filename) VALUES ($1)`,
        [file]
      );
      await client.query('COMMIT');
      console.log(`✓ ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`✗ ${file}:`, (err as Error).message);
      process.exit(1);
    } finally {
      client.release();
    }
  }

  console.log('Migration complete.');
  await pool.end();
}

// Run migrations if called directly
if (require.main === module) {
  runMigrations();
}
