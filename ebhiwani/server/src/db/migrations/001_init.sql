-- ================================================================
-- eBhiwani Database Migration
-- Run this file once to set up the schema
-- psql -U postgres -d ebhiwani -f migrations/001_init.sql
-- ================================================================

-- Enable pgcrypto for PII encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------
-- USERS  (shared across all 4 modules)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(100) UNIQUE NOT NULL,
  -- mobile stored encrypted
  mobile_enc    TEXT,
  password_hash TEXT NOT NULL,
  full_name     VARCHAR(200) NOT NULL,
  email         VARCHAR(200),
  role          VARCHAR(50) NOT NULL DEFAULT 'operator',
  -- Allowed values: phed_admin | phed_nodal | phed_operator | dc_monitor
  -- Future: court_entry | np_admin | np_operator
  module_access TEXT[] NOT NULL DEFAULT '{"phed"}',
  -- Future modules: 'court', 'np', 'dc'
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- REFRESH TOKENS
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- AUDIT LOG
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGSERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id   VARCHAR(100),
  ip_address  INET,
  user_agent  TEXT,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- TEHSILS
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tehsils (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  district   VARCHAR(100) NOT NULL DEFAULT 'Bhiwani',
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- COMPLAINT CATEGORIES  (PHED module)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS complaint_categories (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  module      VARCHAR(50) NOT NULL DEFAULT 'phed',
  sla_days    INTEGER NOT NULL DEFAULT 5,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- COMPLAINTS  (PHED Module C)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS complaints (
  id                    BIGSERIAL PRIMARY KEY,
  -- 6-digit display ID (starts at 100001 via sequence)
  complaint_number      INTEGER UNIQUE NOT NULL,
  source                VARCHAR(50) NOT NULL DEFAULT 'Walk-in',
  tehsil_id             INTEGER NOT NULL REFERENCES tehsils(id),
  location              TEXT NOT NULL,            -- ward / village (open text)
  category_id           INTEGER NOT NULL REFERENCES complaint_categories(id),
  description           TEXT,
  -- PII encrypted with pgcrypto (key stored in env)
  complainant_name_enc  TEXT NOT NULL,
  complainant_phone_enc TEXT NOT NULL,
  status                VARCHAR(30) NOT NULL DEFAULT 'New',
  -- Allowed: New | Pending | In Progress | Resolved | Closed
  assigned_to           INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_by            INTEGER NOT NULL REFERENCES users(id),
  due_date              DATE,
  closed_at             TIMESTAMPTZ,
  resolution_summary    TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sequence for 6-digit complaint numbers
CREATE SEQUENCE IF NOT EXISTS complaint_number_seq START 100001;

-- ----------------------------------------------------------------
-- STATUS HISTORY
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS status_history (
  id            BIGSERIAL PRIMARY KEY,
  complaint_id  BIGINT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  from_status   VARCHAR(30),
  to_status     VARCHAR(30) NOT NULL,
  updated_by    INTEGER NOT NULL REFERENCES users(id),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- ASSIGNMENTS
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assignments (
  id            BIGSERIAL PRIMARY KEY,
  complaint_id  BIGINT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  assigned_to   INTEGER NOT NULL REFERENCES users(id),
  assigned_by   INTEGER NOT NULL REFERENCES users(id),
  due_date      DATE,
  comments      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- ATTACHMENTS
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attachments (
  id            BIGSERIAL PRIMARY KEY,
  complaint_id  BIGINT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  original_name VARCHAR(255) NOT NULL,
  stored_name   VARCHAR(255) NOT NULL,
  mime_type     VARCHAR(100) NOT NULL,
  size_bytes    INTEGER NOT NULL,
  uploaded_by   INTEGER NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- INDEXES for performance
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_complaints_status       ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_tehsil       ON complaints(tehsil_id);
CREATE INDEX IF NOT EXISTS idx_complaints_category     ON complaints(category_id);
CREATE INDEX IF NOT EXISTS idx_complaints_assigned_to  ON complaints(assigned_to);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at   ON complaints(created_at);
CREATE INDEX IF NOT EXISTS idx_complaints_number       ON complaints(complaint_number);
CREATE INDEX IF NOT EXISTS idx_status_history_cid      ON status_history(complaint_id);
CREATE INDEX IF NOT EXISTS idx_attachments_cid         ON attachments(complaint_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user          ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity        ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user     ON refresh_tokens(user_id);
