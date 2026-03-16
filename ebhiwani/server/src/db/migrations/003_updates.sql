-- ================================================================
-- eBhiwani Migration 003 — Role renames, user fields, priority
-- Run: psql -U postgres -d ebhiwani -f src/db/migrations/003_updates.sql
-- ================================================================

-- 1. Rename roles to match new naming convention
UPDATE users SET role = 'phed_updater' WHERE role = 'phed_operator';
UPDATE users SET role = 'dc_viewer'    WHERE role = 'dc_monitor';
UPDATE users SET role = 'phed_admin'   WHERE role = 'phed_nodal';

-- 2. Extend users table with department + designation
ALTER TABLE users ADD COLUMN IF NOT EXISTS department   VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS designation  VARCHAR(200);

-- Back-fill department based on role
UPDATE users SET department = 'Administration' WHERE role = 'system_admin'                 AND department IS NULL;
UPDATE users SET department = 'PHED'           WHERE role IN ('phed_admin','phed_updater') AND department IS NULL;
UPDATE users SET department = 'District'       WHERE role = 'dc_viewer'                    AND department IS NULL;

-- 3. Add priority column to complaints
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'Medium';

-- 4. Seed system_admin user (password: Admin@123)
INSERT INTO users (username, full_name, email, role, module_access, department, password_hash, is_active)
VALUES (
  'sysadmin',
  'System Administrator',
  'sysadmin@ebhiwani.gov.in',
  'system_admin',
  '{"phed","dc","court","np"}',
  'Administration',
  '$2b$12$tp6M9zA2B5UqG2nqvkfO4uhuFW4tVZcN/hQpvACKC7JSJZGHCrZm2',
  TRUE
) ON CONFLICT (username) DO NOTHING;
