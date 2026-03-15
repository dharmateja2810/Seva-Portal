-- ================================================================
-- Seed Data
-- ================================================================

-- Tehsils of Bhiwani district
INSERT INTO tehsils (name, district) VALUES
  ('Bhiwani',      'Bhiwani'),
  ('Bawani Khera', 'Bhiwani'),
  ('Loharu',       'Bhiwani'),
  ('Tosham',       'Bhiwani'),
  ('Siwani',       'Bhiwani')
ON CONFLICT DO NOTHING;

-- PHED complaint categories with SLA days
INSERT INTO complaint_categories (name, module, sla_days) VALUES
  ('No Water Supply',  'phed', 3),
  ('Low Pressure',     'phed', 5),
  ('Dirty Water',      'phed', 4),
  ('Pipeline Leakage', 'phed', 5),
  ('Sewer Blockage',   'phed', 3),
  ('Overflow',         'phed', 2),
  ('Others',           'phed', 7)
ON CONFLICT DO NOTHING;

-- Default admin user
-- Password: Admin@123
INSERT INTO users (username, full_name, email, role, module_access, password_hash)
VALUES (
  'admin',
  'System Administrator',
  'admin@ebhiwani.gov.in',
  'phed_admin',
  '{"phed","dc","court","np"}',
  '$2b$12$tp6M9zA2B5UqG2nqvkfO4uhuFW4tVZcN/hQpvACKC7JSJZGHCrZm2'
) ON CONFLICT (username) DO NOTHING;

-- PHED Nodal Officer
INSERT INTO users (username, full_name, email, role, module_access, password_hash)
VALUES (
  'nodal',
  'Rajesh Kumar',
  'rajesh@ebhiwani.gov.in',
  'phed_nodal',
  '{"phed"}',
  '$2b$12$tp6M9zA2B5UqG2nqvkfO4uhuFW4tVZcN/hQpvACKC7JSJZGHCrZm2'
) ON CONFLICT (username) DO NOTHING;

-- DC Office user (monitoring only)
INSERT INTO users (username, full_name, email, role, module_access, password_hash)
VALUES (
  'dcoffice',
  'DC Office',
  'dc@ebhiwani.gov.in',
  'dc_monitor',
  '{"phed","dc"}',
  '$2b$12$tp6M9zA2B5UqG2nqvkfO4uhuFW4tVZcN/hQpvACKC7JSJZGHCrZm2'
) ON CONFLICT (username) DO NOTHING;
