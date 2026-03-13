import cron from 'node-cron';
import { query } from '../db/pool';
import { config } from '../config';
import { logger } from '../utils/logger';
import {
  sendEmail,
  buildOverdueAlertHtml,
  OverdueComplaint,
} from '../utils/mailer';

// ── Overdue complaint alert ──────────────────────────────────────
async function checkOverdueComplaints(): Promise<void> {
  logger.info('Scheduler: checking for overdue complaints…');

  try {
    const complaints = await query<OverdueComplaint>(
      `SELECT
         c.complaint_number,
         cc.name AS category_name,
         t.name  AS tehsil_name,
         c.location,
         EXTRACT(DAY FROM NOW() - c.created_at)::int AS days_open,
         u.full_name AS assigned_to_name
       FROM complaints c
       JOIN complaint_categories cc ON cc.id = c.category_id
       JOIN tehsils              t  ON t.id  = c.tehsil_id
       LEFT JOIN users           u  ON u.id  = c.assigned_to
       WHERE c.status NOT IN ('Closed', 'Resolved')
         AND c.created_at < NOW() - ($1 || ' days')::interval
       ORDER BY days_open DESC`,
      [config.alerts.overdueThresholdDays]
    );

    if (complaints.length === 0) {
      logger.info('Scheduler: no overdue complaints found');
      return;
    }

    logger.warn(`Scheduler: ${complaints.length} overdue complaint(s) found — sending alert`);

    await sendEmail({
      to: config.email.adminEmail,
      subject: `[eBhiwani Alert] ${complaints.length} Overdue Complaint(s) — Action Required`,
      html: buildOverdueAlertHtml(complaints),
      text: complaints
        .map(
          (c: OverdueComplaint) =>
            `#${c.complaint_number} | ${c.category_name} | ${c.tehsil_name} — ${c.location} | ${c.days_open} days open | ${c.assigned_to_name ?? 'Unassigned'}`
        )
        .join('\n'),
    });

    logger.info('Scheduler: overdue alert email sent', {
      count: complaints.length,
      to: config.email.adminEmail,
    });
  } catch (err) {
    logger.error('Scheduler: overdue check failed', { err });
  }
}

// ── Register cron ────────────────────────────────────────────────
export function startScheduler(): void {
  const cronExpr = config.alerts.overdueCheckCron; // default: '0 8 * * *'

  if (!cron.validate(cronExpr)) {
    logger.error('Scheduler: invalid cron expression', { cronExpr });
    return;
  }

  cron.schedule(cronExpr, checkOverdueComplaints, {
    timezone: 'Asia/Kolkata',
  });

  logger.info(`Scheduler: overdue alert job registered [${cronExpr}]`);
}
