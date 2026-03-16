-- ================================================================
-- Migration 004 — Deduplicate tables + add unique constraints
-- ================================================================

-- 1. Re-point complaints to the canonical (lowest) tehsil id before deleting dupes
UPDATE complaints
SET tehsil_id = canon.min_id
FROM (
  SELECT MIN(id) AS min_id, name FROM tehsils GROUP BY name
) AS canon
JOIN tehsils t ON t.name = canon.name
WHERE complaints.tehsil_id = t.id
  AND t.id <> canon.min_id;

-- 2. Remove duplicate tehsils (keep lowest id per name)
DELETE FROM tehsils
WHERE id NOT IN (
  SELECT MIN(id) FROM tehsils GROUP BY name
);

-- 3. Re-point complaints to the canonical (lowest) category id before deleting dupes
UPDATE complaints
SET category_id = canon.min_id
FROM (
  SELECT MIN(id) AS min_id, name, module FROM complaint_categories GROUP BY name, module
) AS canon
JOIN complaint_categories c ON c.name = canon.name AND c.module = canon.module
WHERE complaints.category_id = c.id
  AND c.id <> canon.min_id;

-- 4. Remove duplicate complaint_categories (keep lowest id per name+module)
DELETE FROM complaint_categories
WHERE id NOT IN (
  SELECT MIN(id) FROM complaint_categories GROUP BY name, module
);

-- 3. Remove duplicate users with same username (keep lowest id — should be none due to existing UNIQUE, but safety)
-- username already has UNIQUE constraint from 001_init.sql, skip.

-- 4. Add UNIQUE constraint on tehsils.name (within same district)
ALTER TABLE tehsils
  DROP CONSTRAINT IF EXISTS uq_tehsils_name,
  ADD CONSTRAINT uq_tehsils_name UNIQUE (name);

-- 5. Add UNIQUE constraint on complaint_categories name+module
ALTER TABLE complaint_categories
  DROP CONSTRAINT IF EXISTS uq_categories_name_module,
  ADD CONSTRAINT uq_categories_name_module UNIQUE (name, module);

-- 6. Mark previous migrations as applied in tracking table so they don't re-run
-- (This migration only runs once now that tracking is in place.)
INSERT INTO schema_migrations (filename) VALUES
  ('001_init.sql'),
  ('002_seed.sql'),
  ('003_updates.sql')
ON CONFLICT (filename) DO NOTHING;
