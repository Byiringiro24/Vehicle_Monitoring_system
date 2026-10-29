/**
 * ARTIC VMS — Email Service
 * Uses nodemailer with any SMTP provider (configured via env vars).
 * Gmail: host=smtp.gmail.com, port=587, SMTP_SECURE=false
 * All templates are plain-HTML with inline styles for maximum email client
 * compatibility. Never log passwords or raw reset tokens.
 */
import nodemailer from 'nodemailer';
import logger from '../utils/logger';

// ── Transporter (singleton) ──────────────────────────────────────────────────
let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (_transporter) return _transporter;

  const secure = process.env.SMTP_SECURE === 'true';

  _transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure,                                   // true for 465, false for 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
  });

  return _transporter;
}

// ── Shared layout ─────────────────────────────────────────────────────────────
function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);padding:32px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="color:#ffffff;font-size:24px;font-weight:800;letter-spacing:1px;">ARTIC</span>
                  <span style="color:#60a5fa;font-size:24px;font-weight:800;">.</span>
                  <div style="color:#93c5fd;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-top:2px;">Vehicle Monitoring System</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            ${body}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:24px 40px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
              This email was sent by ARTIC VMS &bull; Vehicle Monitoring System<br/>
              If you did not request this, you can safely ignore it.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Button helper ─────────────────────────────────────────────────────────────
function btn(url: string, text: string, color = '#2563eb'): string {
  return `<div style="text-align:center;margin:32px 0;">
    <a href="${url}" style="display:inline-block;background:${color};color:#ffffff;font-size:16px;font-weight:600;padding:14px 36px;border-radius:8px;text-decoration:none;letter-spacing:0.3px;">${text}</a>
  </div>`;
}

// ── Send helper ───────────────────────────────────────────────────────────────
async function send(to: string, subject: string, html: string): Promise<void> {
  // Gmail SMTP replaces the from address with the authenticated Gmail account.
  // To show "ARTIC VMS" as the sender name, we must use the SMTP_USER address
  // (the Gmail account) in the from field, with "ARTIC VMS" as the display name.
  // If SMTP_FROM is set explicitly in .env, use that instead.
  const smtpUser = process.env.SMTP_USER ?? 'noreply@articvms.ddnsgeek.com';
  const from = process.env.SMTP_FROM ?? `"ARTIC VMS" <${smtpUser}>`;
  const replyTo = process.env.SMTP_REPLY_TO ?? '"ARTIC VMS Support" <byiringirofabrice6@gmail.com>';
  try {
    await getTransporter().sendMail({ from, to, subject, html, replyTo });
    logger.info(`[EMAIL] Sent "${subject}" → ${to}`);
  } catch (err: any) {
    // Log the error but don't crash the request — email is best-effort
    logger.error(`[EMAIL] Failed to send "${subject}" to ${to}: ${err.message}`);
    throw err; // re-throw so callers can decide whether to surface it
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//  EMAIL TEMPLATES
// ═════════════════════════════════════════════════════════════════════════════

// ── Welcome / account created ─────────────────────────────────────────────────
export async function sendWelcomeEmail(to: string, firstName: string): Promise<void> {
  const appUrl = process.env.APP_URL ?? 'https://articvms.ddnsgeek.com';
  const body = `
    <h2 style="color:#1e293b;font-size:22px;margin:0 0 16px;">Welcome to ARTIC VMS, ${firstName}!</h2>
    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">
      Your account has been created. You can now log in to the ARTIC Vehicle Monitoring System to manage your fleet, track vehicles, and access your dashboard.
    </p>
    ${btn(`${appUrl}/login`, 'Go to Dashboard')}
    <p style="color:#94a3b8;font-size:13px;margin:16px 0 0;">
      If you have questions, contact your system administrator.
    </p>`;
  await send(to, 'Welcome to ARTIC VMS', layout('Welcome to ARTIC VMS', body));
}

// ── Password reset request ────────────────────────────────────────────────────
export async function sendPasswordResetEmail(
  to: string,
  firstName: string,
  resetToken: string,
): Promise<void> {
  const appUrl    = process.env.APP_URL ?? 'https://articvms.ddnsgeek.com';
  const resetUrl  = `${appUrl}/reset-password?token=${resetToken}`;
  const expiryMin = 30;

  const body = `
    <h2 style="color:#1e293b;font-size:22px;margin:0 0 16px;">Reset your password</h2>
    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">
      Hi ${firstName}, we received a request to reset the password for your ARTIC VMS account.
    </p>
    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 8px;">
      Click the button below to choose a new password. This link expires in <strong>${expiryMin} minutes</strong>.
    </p>
    ${btn(resetUrl, 'Reset Password', '#dc2626')}
    <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:24px 0;">
      <p style="margin:0;color:#92400e;font-size:13px;">
        <strong>Security tip:</strong> If you did not request a password reset, ignore this email. Your password will not change. Do not share this link with anyone.
      </p>
    </div>
    <p style="color:#94a3b8;font-size:13px;margin:16px 0 0;">
      If the button does not work, copy and paste this URL into your browser:<br/>
      <a href="${resetUrl}" style="color:#2563eb;word-break:break-all;">${resetUrl}</a>
    </p>`;
  await send(to, 'Reset your ARTIC VMS password', layout('Reset your password', body));
}

// ── Password changed confirmation ─────────────────────────────────────────────
export async function sendPasswordChangedEmail(to: string, firstName: string): Promise<void> {
  const appUrl = process.env.APP_URL ?? 'https://articvms.ddnsgeek.com';
  const body = `
    <h2 style="color:#1e293b;font-size:22px;margin:0 0 16px;">Your password was changed</h2>
    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">
      Hi ${firstName}, this is a confirmation that the password for your ARTIC VMS account was successfully changed.
    </p>
    <div style="background:#dcfce7;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:24px 0;">
      <p style="margin:0;color:#166534;font-size:13px;">
        <strong>If you made this change</strong>, no further action is needed.
      </p>
    </div>
    <div style="background:#fee2e2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:24px 0;">
      <p style="margin:0;color:#991b1b;font-size:13px;">
        <strong>If you did NOT make this change</strong>, please contact your system administrator immediately or 
        <a href="${appUrl}/forgot-password" style="color:#dc2626;">reset your password now</a>.
      </p>
    </div>`;
  await send(to, 'Your ARTIC VMS password was changed', layout('Password changed', body));
}

// ── Overdue payment reminder ──────────────────────────────────────────────────
export async function sendOverduePaymentEmail(
  to: string,
  customerName: string,
  details: { vehiclePlate: string; amount: number; currency: string; daysOverdue: number; contractNumber: string },
): Promise<void> {
  const appUrl = process.env.APP_URL ?? 'https://articvms.ddnsgeek.com';
  const body = `
    <h2 style="color:#dc2626;font-size:22px;margin:0 0 16px;">⚠ Payment Overdue</h2>
    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">
      Dear ${customerName}, a payment for your vehicle contract is overdue. Please contact us or make a payment as soon as possible to avoid penalties.
    </p>
    <table width="100%" cellpadding="12" cellspacing="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;margin:24px 0;">
      <tr><td style="color:#475569;font-size:14px;"><strong>Contract #:</strong></td><td style="color:#1e293b;font-size:14px;">${details.contractNumber}</td></tr>
      <tr style="background:#fff1f2;"><td style="color:#475569;font-size:14px;"><strong>Vehicle:</strong></td><td style="color:#1e293b;font-size:14px;">${details.vehiclePlate}</td></tr>
      <tr><td style="color:#475569;font-size:14px;"><strong>Amount due:</strong></td><td style="color:#dc2626;font-size:14px;font-weight:600;">${details.currency} ${details.amount.toLocaleString()}</td></tr>
      <tr style="background:#fff1f2;"><td style="color:#475569;font-size:14px;"><strong>Days overdue:</strong></td><td style="color:#dc2626;font-size:14px;font-weight:600;">${details.daysOverdue} days</td></tr>
    </table>
    ${btn(`${appUrl}/login`, 'View Payment Details', '#dc2626')}`;
  await send(to, `ARTIC VMS — ⚠ Overdue Payment — Contract ${details.contractNumber}`, layout('Overdue Payment', body));
}

// ── Document expiry warning ───────────────────────────────────────────────────
export async function sendDocumentExpiryEmail(
  to: string,
  recipientName: string,
  docs: Array<{ label: string; identifier: string; expiryDate: string; daysLeft: number }>,
): Promise<void> {
  const appUrl = process.env.APP_URL ?? 'https://articvms.ddnsgeek.com';

  const rows = docs.map((d, i) => `
    <tr style="${i % 2 === 1 ? 'background:#f8fafc;' : ''}">
      <td style="padding:10px 12px;color:#1e293b;font-size:14px;">${d.label}</td>
      <td style="padding:10px 12px;color:#475569;font-size:14px;">${d.identifier}</td>
      <td style="padding:10px 12px;color:#1e293b;font-size:14px;">${d.expiryDate}</td>
      <td style="padding:10px 12px;text-align:center;">
        <span style="background:${d.daysLeft <= 7 ? '#fee2e2' : '#fef3c7'};color:${d.daysLeft <= 7 ? '#991b1b' : '#92400e'};font-size:12px;font-weight:600;padding:3px 10px;border-radius:20px;">
          ${d.daysLeft <= 0 ? 'EXPIRED' : `${d.daysLeft}d left`}
        </span>
      </td>
    </tr>`).join('');

  const body = `
    <h2 style="color:#d97706;font-size:22px;margin:0 0 16px;">📋 Document Expiry Reminder</h2>
    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">
      Hi ${recipientName}, the following documents are expiring soon or have already expired. Please renew them to avoid compliance issues.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin:24px 0;">
      <thead>
        <tr style="background:#1e3a5f;">
          <th style="padding:12px;color:#ffffff;font-size:12px;text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Document</th>
          <th style="padding:12px;color:#ffffff;font-size:12px;text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Vehicle / Holder</th>
          <th style="padding:12px;color:#ffffff;font-size:12px;text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Expires</th>
          <th style="padding:12px;color:#ffffff;font-size:12px;text-align:center;text-transform:uppercase;letter-spacing:0.5px;">Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    ${btn(`${appUrl}/vehicles`, 'Manage Documents', '#d97706')}`;
  await send(to, `ARTIC VMS — 📋 ${docs.length} document(s) expiring soon`, layout('Document Expiry Reminder', body));
}

// ── Vehicle offline alert ─────────────────────────────────────────────────────
export async function sendVehicleOfflineEmail(
  to: string,
  managerName: string,
  vehicle: { name: string; licensePlate: string; lastSeenAt: string },
): Promise<void> {
  const appUrl = process.env.APP_URL ?? 'https://articvms.ddnsgeek.com';
  const body = `
    <h2 style="color:#dc2626;font-size:22px;margin:0 0 16px;">🚨 Vehicle Offline Alert</h2>
    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">
      Hi ${managerName}, a vehicle in your fleet has gone offline and has not reported a GPS position.
    </p>
    <table width="100%" cellpadding="12" cellspacing="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;margin:24px 0;">
      <tr><td style="color:#475569;font-size:14px;"><strong>Vehicle:</strong></td><td style="color:#1e293b;font-size:14px;">${vehicle.name}</td></tr>
      <tr style="background:#fff1f2;"><td style="color:#475569;font-size:14px;"><strong>Plate:</strong></td><td style="color:#1e293b;font-size:14px;">${vehicle.licensePlate}</td></tr>
      <tr><td style="color:#475569;font-size:14px;"><strong>Last seen:</strong></td><td style="color:#dc2626;font-size:14px;font-weight:600;">${vehicle.lastSeenAt}</td></tr>
    </table>
    ${btn(`${appUrl}/map`, 'View Live Map', '#dc2626')}`;
  await send(to, `ARTIC VMS — 🚨 Vehicle Offline: ${vehicle.licensePlate}`, layout('Vehicle Offline', body));
}

// ── Invitation email ──────────────────────────────────────────────────────────
export async function sendInvitationEmail(
  to: string,
  recipientName: string,
  orgName: string,
  role: string,
  actionUrl: string,
  setupToken: string | null,
): Promise<void> {
  const isNew = setupToken !== null;
  const roleLabel = role.replace(/_/g, ' ');
  const body = `
    <h2 style="color:#1e293b;font-size:22px;margin:0 0 16px;">
      You've been invited to join ${orgName}
    </h2>
    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">
      Hi ${recipientName}, you have been invited to join <strong>${orgName}</strong> on ARTIC VMS
      with the role of <strong>${roleLabel}</strong>.
    </p>
    ${isNew ? `
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin:24px 0;">
      <p style="margin:0;color:#1e40af;font-size:13px;">
        <strong>New account created for you.</strong> Click the button below to set your password and activate your account.
        This link expires in <strong>72 hours</strong>.
      </p>
    </div>` : `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:24px 0;">
      <p style="margin:0;color:#166534;font-size:13px;">
        <strong>Your existing account has been linked.</strong> Sign in with your current credentials to access ${orgName}.
      </p>
    </div>`}
    ${btn(actionUrl, isNew ? 'Set Password & Activate Account' : 'Sign In to Dashboard')}
    <p style="color:#94a3b8;font-size:13px;margin:16px 0 0;">
      If you did not expect this invitation, you can ignore this email.
    </p>`;
  const subject = isNew
    ? `ARTIC VMS — You've been invited to ${orgName} — Set up your account`
    : `ARTIC VMS — You've been added to ${orgName}`;
  await send(to, subject, layout(subject, body));
}

// ── New registration notification (to Super Admin) ────────────────────────────
export async function sendNewRegistrationAlert(
  adminEmail: string,
  orgName: string,
  adminName: string,
  orgId: string,
): Promise<void> {
  const appUrl = process.env.APP_URL ?? 'https://articvms.ddnsgeek.com';
  const body = `
    <h2 style="color:#1e293b;font-size:22px;margin:0 0 16px;">🏢 New Organization Registration</h2>
    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">
      A new organization has registered and is awaiting your approval.
    </p>
    <table width="100%" cellpadding="12" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin:24px 0;">
      <tr><td style="color:#475569;font-size:14px;"><strong>Organization:</strong></td><td style="color:#1e293b;font-size:14px;">${orgName}</td></tr>
      <tr style="background:#f1f5f9;"><td style="color:#475569;font-size:14px;"><strong>Admin contact:</strong></td><td style="color:#1e293b;font-size:14px;">${adminName}</td></tr>
    </table>
    ${btn(`${appUrl}/platform`, 'Review Registration', '#059669')}`;
  await send(adminEmail, `ARTIC VMS — New registration: ${orgName} — Approval required`, layout('New Registration', body));
}

// ── Verify SMTP config (called at startup) ────────────────────────────────────
export async function verifySmtpConnection(): Promise<boolean> {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    logger.warn('[EMAIL] SMTP not configured — email sending disabled');
    return false;
  }
  try {
    await getTransporter().verify();
    logger.info(`[EMAIL] SMTP connection verified (${process.env.SMTP_HOST}:${process.env.SMTP_PORT})`);
    return true;
  } catch (err: any) {
    logger.warn(`[EMAIL] SMTP verification failed: ${err.message}`);
    return false;
  }
}
