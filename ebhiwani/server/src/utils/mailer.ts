import nodemailer from 'nodemailer';
import { config } from '../config';
import { logger } from './logger';

const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: config.email.secure,
  auth: config.email.user
    ? { user: config.email.user, pass: config.email.pass }
    : undefined,
});

// ── Rich templates ───────────────────────────────────────────────

export interface OverdueComplaint {
  complaint_number: number;
  category_name: string;
  tehsil_name: string;
  location: string;
  days_open: number;
  assigned_to_name: string | null;
}

export function buildOverdueAlertHtml(complaints: OverdueComplaint[]): string {
  const rows = complaints
    .map(
      (c) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#4338ca">${c.complaint_number}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${c.category_name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${c.tehsil_name} — ${c.location}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#dc2626;font-weight:600">${c.days_open} days</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${c.assigned_to_name ?? 'Unassigned'}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="font-family:Inter,system-ui,sans-serif;background:#f9fafb;padding:32px">
  <div style="max-width:700px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
    <div style="background:#1e3a5f;padding:24px 32px">
      <h1 style="color:#fff;margin:0;font-size:20px">⚠️ eBhiwani — Overdue Complaints Alert</h1>
      <p style="color:#93c5fd;margin:6px 0 0;font-size:13px">District Administration Bhiwani — PHED Module</p>
    </div>
    <div style="padding:24px 32px">
      <p style="color:#374151;margin-top:0">
        The following <strong>${complaints.length} complaint(s)</strong> have been open for more than
        <strong>${config.alerts.overdueThresholdDays} days</strong> without resolution:
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#f3f4f6">
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase">ID</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase">Category</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase">Location</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase">Days Open</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase">Assigned To</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="color:#6b7280;font-size:12px;margin-top:24px;margin-bottom:0">
        Please log in to the eBhiwani Portal to take action.
      </p>
    </div>
    <div style="background:#f9fafb;padding:12px 32px;border-top:1px solid #e5e7eb">
      <p style="color:#9ca3af;font-size:11px;margin:0">© District Administration Bhiwani — Automated alert. Do not reply.</p>
    </div>
  </div>
</body></html>`;
}

export function buildStatusUpdateHtml(data: {
  complaintNumber: number;
  category: string;
  tehsil: string;
  location: string;
  oldStatus: string;
  newStatus: string;
  updatedBy: string;
  notes?: string;
}): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="font-family:Inter,system-ui,sans-serif;background:#f9fafb;padding:32px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
    <div style="background:#1e3a5f;padding:24px 32px">
      <h1 style="color:#fff;margin:0;font-size:20px">Complaint Status Updated</h1>
      <p style="color:#93c5fd;margin:6px 0 0;font-size:13px">eBhiwani — PHED Complaint System</p>
    </div>
    <div style="padding:24px 32px">
      <table style="width:100%;font-size:14px;border-collapse:collapse">
        <tr><td style="padding:7px 0;color:#6b7280;width:120px">Complaint #</td><td style="padding:7px 0;font-weight:600;color:#4338ca">${data.complaintNumber}</td></tr>
        <tr><td style="padding:7px 0;color:#6b7280">Category</td><td style="padding:7px 0">${data.category}</td></tr>
        <tr><td style="padding:7px 0;color:#6b7280">Location</td><td style="padding:7px 0">${data.tehsil} — ${data.location}</td></tr>
        <tr><td style="padding:7px 0;color:#6b7280">Status</td>
          <td style="padding:7px 0">
            <span style="color:#6b7280;text-decoration:line-through">${data.oldStatus}</span>
            &nbsp;→&nbsp;<strong style="color:#059669">${data.newStatus}</strong>
          </td>
        </tr>
        <tr><td style="padding:7px 0;color:#6b7280">Updated By</td><td style="padding:7px 0">${data.updatedBy}</td></tr>
        ${data.notes ? `<tr><td style="padding:7px 0;color:#6b7280;vertical-align:top">Notes</td><td style="padding:7px 0;color:#374151">${data.notes}</td></tr>` : ''}
      </table>
    </div>
    <div style="background:#f9fafb;padding:12px 32px;border-top:1px solid #e5e7eb">
      <p style="color:#9ca3af;font-size:11px;margin:0">© District Administration Bhiwani</p>
    </div>
  </div>
</body></html>`;
}


interface MailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(opts: MailOptions): Promise<void> {
  if (!config.email.user) {
    logger.warn('Email not configured — skipping send', { subject: opts.subject });
    return;
  }
  try {
    await transporter.sendMail({
      from: config.email.from,
      ...opts,
    });
    logger.info('Email sent', { to: opts.to, subject: opts.subject });
  } catch (err) {
    logger.error('Email send failed', {
      subject: opts.subject,
      error: (err as Error).message,
    });
  }
}

export async function sendAlertEmail(subject: string, body: string): Promise<void> {
  await sendEmail({
    to: config.email.adminEmail,
    subject: `[eBhiwani Alert] ${subject}`,
    html: `<div style="font-family:sans-serif">${body}</div>`,
    text: body,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  tempPassword: string
): Promise<void> {
  await sendEmail({
    to,
    subject: 'eBhiwani — Your Temporary Password',
    html: `
      <div style="font-family:sans-serif; max-width:500px; margin:auto">
        <h2 style="color:#1e3a5f">eBhiwani District Administration Portal</h2>
        <p>Hello ${name},</p>
        <p>Your temporary password is:</p>
        <p style="font-size:1.5rem; font-weight:bold; letter-spacing:2px; color:#1e3a5f">${tempPassword}</p>
        <p>Please log in and change your password immediately.</p>
        <hr/>
        <small>This is an automated message. Do not reply.</small>
      </div>
    `,
  });
}
