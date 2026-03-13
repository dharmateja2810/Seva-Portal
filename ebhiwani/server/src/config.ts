// ============================================================
// eBhiwani – Central Configuration File
// All tuneable settings live here. Override via .env
// ============================================================

export const config = {
  // ── Server ─────────────────────────────────────────────
  server: {
    port: Number(process.env.PORT) || 5000,
    nodeEnv: process.env.NODE_ENV || 'development',
  },

  // ── Database ────────────────────────────────────────────
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'ebhiwani',
    ssl: process.env.DB_SSL === 'true',
  },

  // ── Authentication ──────────────────────────────────────
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'change-me-in-production-super-secret',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret:
      process.env.JWT_REFRESH_SECRET || 'change-me-refresh-super-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 12,
  },

  // ── Rate Limiting ────────────────────────────────────────
  rateLimit: {
    general: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100,
    },
    auth: {
      windowMs: 15 * 60 * 1000,
      max: process.env.NODE_ENV === 'production' ? 5 : 100,
    },
  },

  // ── Complaint Settings ───────────────────────────────────
  complaints: {
    idStart: 100001, // 6-digit starting ID
    // SLA in days per category (overridable via Masters)
    defaultSla: {
      'No Water Supply': 3,
      'Low Pressure': 5,
      'Dirty Water': 4,
      'Pipeline Leakage': 5,
      'Sewer Blockage': 3,
      Overflow: 2,
      Others: 7,
    } as Record<string, number>,
    // Complaint sources
    sources: [
      'Walk-in',
      'Phone Call',
      'WhatsApp',
      'Inspection',
      'Office Entry',
    ],
  },

  // ── File Uploads ─────────────────────────────────────────
  uploads: {
    dir: process.env.UPLOAD_DIR || 'uploads',
    maxSizeMB: Number(process.env.UPLOAD_MAX_MB) || 5,
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ],
  },

  // ── Email / Alerts ────────────────────────────────────────
  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'noreply@ebhiwani.gov.in',
    adminEmail: process.env.ADMIN_EMAIL || 'admin@ebhiwani.gov.in',
  },

  // ── Alert Thresholds ─────────────────────────────────────
  alerts: {
    // Complain open beyond this many days triggers an alert email
    overdueThresholdDays: Number(process.env.OVERDUE_THRESHOLD_DAYS) || 7,
    // Cron schedule for overdue checks (every day at 8 AM)
    overdueCheckCron: process.env.OVERDUE_CRON || '0 8 * * *',
  },

  // ── CORS ────────────────────────────────────────────────
  cors: {
    origins: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(','),
  },

  // ── Logging ──────────────────────────────────────────────
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || 'logs',
  },
};
