/**
 * MailService — Transactional Email via Resend
 *
 * Uses Resend (https://resend.com) as the email provider.
 * Falls back to console.log in development when RESEND_API_KEY is not set.
 *
 * Required env vars:
 *   RESEND_API_KEY   — from resend.com/api-keys
 *   FROM_EMAIL       — e.g. "24Therapy <noreply@24therapy.ai>"
 *   APP_URL          — e.g. https://24therapy.ai (used for links)
 *   PATIENT_APP_URL  — e.g. https://my.24therapy.ai
 *   THERAPIST_APP_URL — e.g. https://app.24therapy.ai
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly apiKey: string | undefined;
  private readonly fromEmail: string;
  private readonly appUrl: string;
  private readonly patientAppUrl: string;
  private readonly therapistAppUrl: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('RESEND_API_KEY');
    this.fromEmail = this.config.get<string>('FROM_EMAIL') || '24Therapy <noreply@24therapy.ai>';
    this.appUrl = this.config.get<string>('APP_URL') || 'https://24therapy.ai';
    this.patientAppUrl = this.config.get<string>('PATIENT_APP_URL') || 'https://my.24therapy.ai';
    this.therapistAppUrl = this.config.get<string>('THERAPIST_APP_URL') || 'https://app.24therapy.ai';

    if (!this.apiKey) {
      this.logger.warn(
        'RESEND_API_KEY not set — emails will be logged to console only (development mode)',
      );
    }
  }

  // ─── Core send method ─────────────────────────────────────────────────────

  async send(opts: SendEmailOptions): Promise<boolean> {
    if (!this.apiKey) {
      const isProd = this.config.get<string>('nodeEnv') === 'production';
      if (isProd) {
        // In production without RESEND_API_KEY: log metadata only — never log body as it may contain tokens or PHI
        this.logger.warn(`[EMAIL SUPPRESSED] RESEND_API_KEY not set — email NOT sent. To: ${opts.to} | Subject: ${opts.subject}`);
      } else {
        this.logger.log(`[DEV EMAIL] To: ${opts.to} | Subject: ${opts.subject}`);
        this.logger.log(`[DEV EMAIL] Body: ${opts.text || opts.html.replace(/<[^>]+>/g, ' ')}`);
      }
      return true;
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: [opts.to],
          subject: opts.subject,
          html: opts.html,
          text: opts.text,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        this.logger.error(`Resend API error ${res.status}:`, err);
        return false;
      }

      const data = await res.json();
      this.logger.log(`Email sent: ${data.id} → ${opts.to}`);
      return true;
    } catch (error) {
      this.logger.error('Failed to send email:', error.message);
      return false;
    }
  }

  // ─── Transactional email templates ────────────────────────────────────────

  async sendPasswordReset(
    email: string,
    token: string,
    role: 'patient' | 'therapist' | 'admin' | string,
  ): Promise<void> {
    const baseUrl =
      role === 'patient'
        ? this.patientAppUrl
        : role === 'therapist' || role === 'org_admin'
        ? this.therapistAppUrl
        : this.appUrl;

    const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;

    await this.send({
      to: email,
      subject: 'Reset your 24Therapy password',
      text: `Reset your password: ${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, ignore this email.`,
      html: this.buildPasswordResetHtml(resetUrl, role),
    });
  }

  async sendWelcome(
    email: string,
    firstName: string,
    role: 'patient' | 'therapist' | string,
  ): Promise<void> {
    const loginUrl =
      role === 'patient' ? `${this.patientAppUrl}/login` : `${this.therapistAppUrl}/login`;

    await this.send({
      to: email,
      subject: `Welcome to 24Therapy, ${firstName}!`,
      text: `Hi ${firstName},\n\nYour account is ready. Sign in at: ${loginUrl}\n\n— The 24Therapy team`,
      html: this.buildWelcomeHtml(firstName, loginUrl, role),
    });
  }

  // ─── Public assessment results email ─────────────────────────────────────

  async sendAssessmentResults(
    email: string,
    results: Array<{ type: string; score: number; severity: string }>,
    promoCode: string | null,
  ): Promise<void> {
    const NAMES: Record<string, string> = { phq9: 'PHQ-9 (Depression)', gad7: 'GAD-7 (Anxiety)', pcl5: 'PCL-5 (PTSD Screen)' };
    const rows = results.map(r => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#334155;">${NAMES[r.type] || r.type}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#334155;text-align:center;font-weight:600;">${r.score}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#334155;">${r.severity}</td>
      </tr>`).join('');

    const promoSection = promoCode ? `
      <div style="background:#f0fdf4;border:2px solid #22c55e;border-radius:12px;padding:20px;margin:24px 0;text-align:center;">
        <p style="margin:0 0 8px;font-size:13px;color:#16a34a;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Your 50% Discount Code</p>
        <p style="margin:0 0 8px;font-size:28px;font-weight:800;color:#166534;letter-spacing:0.1em;">${promoCode}</p>
        <p style="margin:0;font-size:12px;color:#16a34a;">50% off your first session · One use · New patients only</p>
      </div>` : '';

    await this.send({
      to: email,
      subject: 'Your 24Therapy Mental Health Assessment Results',
      text: `Your assessment results:\n\n${results.map(r => `${NAMES[r.type] || r.type}: ${r.score} — ${r.severity}`).join('\n')}\n\n${promoCode ? `Your 50% discount code: ${promoCode}\n\n` : ''}Find a therapist: ${this.appUrl}/find-therapist\n\nDisclaimer: This is not a clinical diagnosis. Results are for self-awareness only.`,
      html: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
<tr><td style="background:linear-gradient(135deg,#0A2342,#1a3a6b);padding:32px;text-align:center;">
  <span style="color:white;font-size:20px;font-weight:700;">24Therapy.ai</span>
  <p style="color:rgba(255,255,255,0.7);margin:8px 0 0;font-size:14px;">Mental Health Assessment Results</p>
</td></tr>
<tr><td style="padding:32px;">
  <h2 style="margin:0 0 20px;color:#0A2342;font-size:20px;">Your Assessment Results</h2>
  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:4px;">
    <tr style="background:#f8fafc;">
      <th style="padding:10px 12px;text-align:left;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Assessment</th>
      <th style="padding:10px 12px;text-align:center;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Score</th>
      <th style="padding:10px 12px;text-align:left;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Level</th>
    </tr>
    ${rows}
  </table>
  ${promoSection}
  <div style="text-align:center;margin:24px 0;">
    <a href="${this.appUrl}/find-therapist" style="background:#2EC4B6;color:white;text-decoration:none;font-weight:600;font-size:15px;padding:14px 32px;border-radius:10px;display:inline-block;">Find a Therapist →</a>
  </div>
  <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">This is not a clinical diagnosis. Results are for self-awareness only. If you are in crisis, call or text 988.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
    });
  }

  // ─── Billing email templates ──────────────────────────────────────────────

  async sendFirstSessionFree(email: string): Promise<void> {
    await this.send({
      to: email,
      subject: '🎁 Your first session was free — welcome to 24Therapy!',
      text: `Your first session has been completed — and it was on us!\n\nYour next session will be $6, billed after each session. Save 50% with our Starter plan ($59/mo for 20 sessions).\n\nLogin: ${this.therapistAppUrl}`,
      html: this.buildSimpleHtml(
        'Your first session is on us!',
        `<p style="margin:0 0 16px;color:#64748b;line-height:1.6;">Your first session has been completed — and it was completely free.</p>
         <p style="margin:0 0 24px;color:#64748b;line-height:1.6;">Starting from your next session, you'll be billed <strong>$6 per completed session</strong>. Or save 50% with our <strong>Starter plan</strong> — $59/mo for 20 sessions.</p>`,
        { label: 'View Settings', url: `${this.therapistAppUrl}/settings?tab=billing` },
      ),
    });
  }

  async sendSessionBill(email: string, amountDue: number, checkoutUrl: string, description: string): Promise<void> {
    await this.send({
      to: email,
      subject: `Session bill: $${amountDue.toFixed(2)} — pay to unlock new sessions`,
      text: `A session has been completed and a bill of $${amountDue.toFixed(2)} is due.\n\nPay now: ${checkoutUrl}\n\nSave 50% with Starter ($59/mo for 20 sessions): ${this.therapistAppUrl}/settings?tab=billing`,
      html: this.buildSimpleHtml(
        `Session bill: $${amountDue.toFixed(2)}`,
        `<p style="margin:0 0 16px;color:#64748b;line-height:1.6;">${description}</p>
         <p style="margin:0 0 24px;color:#64748b;line-height:1.6;">Pay now to unlock scheduling of new sessions. Or save 50% with Starter ($59/mo for 20 sessions).</p>`,
        { label: `Pay $${amountDue.toFixed(2)}`, url: checkoutUrl },
      ),
    });
  }

  async sendPaymentConfirmed(email: string): Promise<void> {
    await this.send({
      to: email,
      subject: '✅ Payment confirmed — sessions unlocked',
      text: `Your session payment was confirmed. You can now schedule new sessions.\n\n${this.therapistAppUrl}`,
      html: this.buildSimpleHtml(
        'Payment confirmed!',
        `<p style="margin:0 0 24px;color:#64748b;line-height:1.6;">Your session bill has been paid. You can now schedule new sessions.</p>`,
        { label: 'Schedule a session', url: `${this.therapistAppUrl}/sessions/new` },
      ),
    });
  }

  async sendSubscriptionActive(email: string, planKey: string): Promise<void> {
    const planName = planKey === 'pro' ? 'Unlimited' : planKey.charAt(0).toUpperCase() + planKey.slice(1);
    await this.send({
      to: email,
      subject: `🎉 ${planName} plan activated!`,
      text: `Your ${planName} plan is now active. Enjoy your sessions!\n\n${this.therapistAppUrl}`,
      html: this.buildSimpleHtml(
        `${planName} plan activated!`,
        `<p style="margin:0 0 24px;color:#64748b;line-height:1.6;">Your ${planName} subscription is now active. Sessions are included in your plan.</p>`,
        { label: 'Go to dashboard', url: `${this.therapistAppUrl}/dashboard` },
      ),
    });
  }

  async sendSessionInvite(to: string, therapistName: string, joinUrl: string, scheduledAt?: Date): Promise<void> {
    const timeStr = scheduledAt ? new Date(scheduledAt).toLocaleString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }) : 'Anytime (join when ready)';
    await this.send({
      to,
      subject: `${therapistName} invited you to a therapy session`,
      html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>You've been invited to a session</h2>
        <p><strong>${therapistName}</strong> has invited you to a therapy session.</p>
        <p><strong>Time:</strong> ${timeStr}</p>
        <p>No account needed — just click the button below to join:</p>
        <a href="${joinUrl}" style="display:inline-block;background:#1F5EFF;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;">Join Session</a>
        <p style="color:#666;font-size:12px;">Or copy this link: ${joinUrl}</p>
        <p style="color:#888;font-size:11px;">Your privacy is protected. This session uses end-to-end encryption.</p>
      </div>
    `,
    });
  }

  async sendQuotaWarning(email: string, remaining: number): Promise<void> {
    await this.send({
      to: email,
      subject: `⚠️ Only ${remaining} session${remaining === 1 ? '' : 's'} left this month`,
      text: `You have ${remaining} included session${remaining === 1 ? '' : 's'} remaining this month.\n\nUpgrade to Unlimited ($99/mo) for unlimited sessions: ${this.therapistAppUrl}/settings?tab=billing`,
      html: this.buildSimpleHtml(
        `${remaining} session${remaining === 1 ? '' : 's'} left this month`,
        `<p style="margin:0 0 16px;color:#64748b;line-height:1.6;">You have <strong>${remaining} included session${remaining === 1 ? '' : 's'}</strong> remaining in your Starter plan this month.</p>
         <p style="margin:0 0 24px;color:#64748b;line-height:1.6;">Extra sessions are $6 each, or upgrade to Unlimited ($99/mo) for unlimited sessions.</p>`,
        { label: 'Upgrade to Unlimited', url: `${this.therapistAppUrl}/settings?tab=billing` },
      ),
    });
  }

  async sendSessionReport(
    to: string,
    therapistName: string,
    sessionDate: string,
    content: {
      session_summary?: string;
      key_talking_points?: string[];
      clinical_observations?: string;
      treatment_recommendations?: string;
      follow_up?: string;
    },
  ): Promise<void> {
    const dateStr = new Date(sessionDate).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const talkingPointsHtml = (content.key_talking_points || []).length > 0
      ? `<ul style="margin:8px 0 16px;padding-left:20px;color:#475569;">${(content.key_talking_points || []).map(p => `<li style="margin-bottom:6px;line-height:1.5;">${p}</li>`).join('')}</ul>`
      : '';

    const sectionsHtml = [
      content.session_summary ? `<h3 style="margin:0 0 6px;font-size:14px;color:#0A2342;">Session Summary</h3><p style="margin:0 0 20px;color:#475569;line-height:1.6;">${content.session_summary}</p>` : '',
      content.key_talking_points?.length ? `<h3 style="margin:0 0 6px;font-size:14px;color:#0A2342;">Key Topics Discussed</h3>${talkingPointsHtml}` : '',
      content.treatment_recommendations ? `<h3 style="margin:0 0 6px;font-size:14px;color:#0A2342;">Recommendations</h3><p style="margin:0 0 20px;color:#475569;line-height:1.6;">${content.treatment_recommendations}</p>` : '',
      content.follow_up ? `<h3 style="margin:0 0 6px;font-size:14px;color:#0A2342;">Next Steps</h3><p style="margin:0 0 20px;color:#475569;line-height:1.6;">${content.follow_up}</p>` : '',
    ].filter(Boolean).join('');

    await this.send({
      to,
      subject: `Your session summary from ${therapistName} — ${dateStr}`,
      html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#0A2342,#1a3a6b);padding:32px;text-align:center;">
          <span style="color:white;font-size:20px;font-weight:700;">24Therapy.ai</span>
          <p style="color:rgba(255,255,255,0.7);font-size:13px;margin:8px 0 0;">Session Report</p>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <p style="margin:0 0 8px;color:#64748b;font-size:13px;">${dateStr}</p>
          <h1 style="margin:0 0 4px;font-size:22px;font-weight:700;color:#0A2342;">Your session with ${therapistName}</h1>
          <p style="margin:0 0 28px;color:#64748b;font-size:14px;">Here is a summary of your session. This document is for your personal reference.</p>
          <div style="border-top:1px solid #f1f5f9;padding-top:24px;">
            ${sectionsHtml || '<p style="color:#94a3b8;font-size:14px;">Your therapist will share notes from this session shortly.</p>'}
          </div>
        </td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid #f1f5f9;background:#f8fafc;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.6;">This summary was prepared by ${therapistName} and shared securely via 24Therapy.ai<br>HIPAA-compliant · End-to-end encrypted</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
    });
  }

  private buildSimpleHtml(title: string, bodyHtml: string, cta: { label: string; url: string }): string {
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#0A2342,#1a3a6b);padding:32px;text-align:center;">
          <span style="color:white;font-size:20px;font-weight:700;">24Therapy.ai</span>
        </td></tr>
        <tr><td style="padding:40px 48px;">
          <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#0A2342;">${title}</h1>
          ${bodyHtml}
          <table cellpadding="0" cellspacing="0"><tr><td style="border-radius:12px;background:#1F5EFF;">
            <a href="${cta.url}" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;">${cta.label}</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="padding:24px 48px;border-top:1px solid #f1f5f9;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">24Therapy.ai · HIPAA-compliant mental health platform</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  async sendEmailVerification(email: string, firstName: string, token: string): Promise<void> {
    const verifyUrl = `${this.appUrl}/verify-email?token=${encodeURIComponent(token)}`;

    await this.send({
      to: email,
      subject: 'Verify your 24Therapy email address',
      text: `Hi ${firstName},\n\nVerify your email: ${verifyUrl}\n\nThis link expires in 24 hours.`,
      html: this.buildVerifyEmailHtml(firstName, verifyUrl),
    });
  }

  // ─── HTML Templates ────────────────────────────────────────────────────────

  private buildPasswordResetHtml(resetUrl: string, role: string): string {
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#0A2342,#1a3a6b);padding:32px;text-align:center;">
          <div style="display:inline-flex;align-items:center;gap:10px;">
            <div style="width:40px;height:40px;background:#1F5EFF;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;">
              <span style="color:white;font-weight:bold;font-size:18px;">24</span>
            </div>
            <span style="color:white;font-size:20px;font-weight:700;">24Therapy.ai</span>
          </div>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:40px 48px;">
          <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#0A2342;">Reset your password</h1>
          <p style="margin:0 0 24px;color:#64748b;line-height:1.6;">
            We received a request to reset the password for your ${role} account.
            Click the button below to set a new password. This link expires in <strong>1 hour</strong>.
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
            <tr><td style="border-radius:12px;background:#1F5EFF;">
              <a href="${resetUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;">
                Reset Password
              </a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;color:#94a3b8;font-size:13px;">Or copy this link into your browser:</p>
          <p style="margin:0 0 32px;word-break:break-all;font-size:12px;color:#64748b;background:#f1f5f9;padding:12px;border-radius:8px;">${resetUrl}</p>
          <p style="margin:0;color:#94a3b8;font-size:13px;">
            If you didn't request a password reset, you can safely ignore this email.
            Your password will not be changed.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:24px 48px;border-top:1px solid #f1f5f9;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">
            24Therapy.ai — HIPAA-compliant mental health platform<br>
            If you're in crisis, call <strong style="color:#ef4444;">988</strong> (Suicide &amp; Crisis Lifeline)
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private buildWelcomeHtml(firstName: string, loginUrl: string, role: string): string {
    const roleLabel = role === 'patient' ? 'Patient' : 'Therapist';
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#0A2342,#1a3a6b);padding:32px;text-align:center;">
          <span style="color:white;font-size:22px;font-weight:700;">Welcome to 24Therapy.ai</span>
        </td></tr>
        <tr><td style="padding:40px 48px;">
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0A2342;">Hi ${firstName}! 👋</h1>
          <p style="margin:0 0 24px;color:#64748b;line-height:1.6;">
            Your ${roleLabel} account is ready. You can now sign in and ${
              role === 'therapist'
                ? 'start using AI-powered clinical tools to transform your practice.'
                : 'connect with your therapist and access your mental health journey.'
            }
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
            <tr><td style="border-radius:12px;background:#1F5EFF;">
              <a href="${loginUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;">
                Sign In to Your Account
              </a>
            </td></tr>
          </table>
          <p style="margin:0;color:#94a3b8;font-size:13px;">
            Questions? Reply to this email or visit our <a href="https://24therapy.ai/help" style="color:#1F5EFF;">help center</a>.
          </p>
        </td></tr>
        <tr><td style="padding:24px 48px;border-top:1px solid #f1f5f9;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">
            24Therapy.ai — HIPAA-compliant mental health platform<br>
            If you're in crisis, call <strong style="color:#ef4444;">988</strong>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private buildVerifyEmailHtml(firstName: string, verifyUrl: string): string {
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#0A2342,#1a3a6b);padding:32px;text-align:center;">
          <span style="color:white;font-size:20px;font-weight:700;">Verify your email</span>
        </td></tr>
        <tr><td style="padding:40px 48px;">
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0A2342;">Hi ${firstName},</h1>
          <p style="margin:0 0 24px;color:#64748b;line-height:1.6;">
            Please verify your email address to complete your 24Therapy account setup.
            This link expires in <strong>24 hours</strong>.
          </p>
          <table cellpadding="0" cellspacing="0">
            <tr><td style="border-radius:12px;background:#1F5EFF;">
              <a href="${verifyUrl}" style="display:inline-block;padding:14px 32px;color:#fff;text-decoration:none;font-weight:600;font-size:15px;">
                Verify Email Address
              </a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:24px 48px;border-top:1px solid #f1f5f9;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">24Therapy.ai — HIPAA-compliant mental health platform</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  async sendBookingConfirmation(
    patientEmail: string,
    patientName: string,
    therapistName: string,
    therapistAvatarUrl: string | null,
    scheduledAt: Date,
    joinUrl: string,
    durationMins: number,
    priceCents: number,
  ): Promise<void> {
    const dateStr = scheduledAt.toLocaleString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
    const priceStr = (priceCents / 100).toFixed(2);
    await this.send({
      to: patientEmail,
      subject: `Your session with ${therapistName} is confirmed`,
      html: `<!DOCTYPE html><html><body style="font-family:Inter,sans-serif;background:#f8fafc;margin:0;padding:32px 0;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
  <table width="600" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <tr><td style="background:#1F5EFF;padding:32px 48px;text-align:center;">
      ${therapistAvatarUrl ? `<img src="${therapistAvatarUrl}" width="64" height="64" style="border-radius:50%;border:3px solid rgba(255,255,255,0.4);margin-bottom:16px;" />` : ''}
      <h1 style="color:#fff;margin:0;font-size:22px;">Booking Confirmed</h1>
      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;">with ${therapistName}</p>
    </td></tr>
    <tr><td style="padding:40px 48px;">
      <p style="color:#1e293b;font-size:16px;">Hi ${patientName},</p>
      <p style="color:#475569;">Your session has been confirmed. Here are the details:</p>
      <div style="background:#f8fafc;border-radius:12px;padding:20px;margin:24px 0;">
        <p style="margin:8px 0;color:#1e293b;"><strong>Date & Time:</strong> ${dateStr}</p>
        <p style="margin:8px 0;color:#1e293b;"><strong>Duration:</strong> ${durationMins} minutes</p>
        <p style="margin:8px 0;color:#1e293b;"><strong>Amount Paid:</strong> $${priceStr}</p>
      </div>
      <table cellpadding="0" cellspacing="0" style="margin:32px 0;">
        <tr><td style="border-radius:12px;background:#1F5EFF;">
          <a href="${joinUrl}" style="display:inline-block;padding:14px 40px;color:#fff;text-decoration:none;font-weight:600;font-size:16px;">
            Join Session →
          </a>
        </td></tr>
      </table>
      <p style="color:#94a3b8;font-size:13px;">Save this link — you'll need it to join. No account required.</p>
    </td></tr>
    <tr><td style="padding:24px 48px;border-top:1px solid #f1f5f9;text-align:center;">
      <p style="margin:0;color:#94a3b8;font-size:12px;">24Therapy.ai — HIPAA-compliant mental health platform</p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`,
    });
  }

  async sendOfflinePaymentLink(
    patientEmail: string,
    patientName: string,
    therapistName: string,
    amountCents: number,
    paymentUrl: string,
    sessionDate: Date,
  ): Promise<void> {
    const dateStr = sessionDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const amountStr = (amountCents / 100).toFixed(2);
    await this.send({
      to: patientEmail,
      subject: `Payment request from ${therapistName}`,
      html: `<!DOCTYPE html><html><body style="font-family:Inter,sans-serif;background:#f8fafc;margin:0;padding:32px 0;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
  <table width="600" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <tr><td style="background:#0f172a;padding:32px 48px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:22px;">Session Invoice</h1>
      <p style="color:rgba(255,255,255,0.7);margin:8px 0 0;">from ${therapistName}</p>
    </td></tr>
    <tr><td style="padding:40px 48px;">
      <p style="color:#475569;">You have a payment due for your session on <strong>${dateStr}</strong>.</p>
      <div style="background:#f8fafc;border-radius:12px;padding:20px;margin:24px 0;text-align:center;">
        <p style="color:#94a3b8;margin:0 0 8px;font-size:13px;">AMOUNT DUE</p>
        <p style="color:#1e293b;font-size:36px;font-weight:700;margin:0;">$${amountStr}</p>
      </div>
      <table cellpadding="0" cellspacing="0" style="margin:32px auto;display:block;text-align:center;">
        <tr><td style="border-radius:12px;background:#1F5EFF;">
          <a href="${paymentUrl}" style="display:inline-block;padding:14px 40px;color:#fff;text-decoration:none;font-weight:600;font-size:16px;">
            Pay Now →
          </a>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:24px 48px;border-top:1px solid #f1f5f9;text-align:center;">
      <p style="margin:0;color:#94a3b8;font-size:12px;">24Therapy.ai — HIPAA-compliant mental health platform</p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`,
    });
  }

  async sendPayoutRequestReceived(
    therapistName: string,
    therapistEmail: string,
    amountCents: number,
  ): Promise<void> {
    const adminEmail = this.config.get<string>('ADMIN_EMAIL') || 'admin@24therapy.ai';
    const amountStr = (amountCents / 100).toFixed(2);
    await this.send({
      to: adminEmail,
      subject: `Payout request: ${therapistName} — $${amountStr}`,
      html: `<p><strong>${therapistName}</strong> (${therapistEmail}) has requested a payout of <strong>$${amountStr}</strong>.</p>
<p>Please review and process in the admin panel.</p>`,
    });
  }

  async sendTherapistBookingAlert(
    therapistEmail: string,
    therapistName: string,
    patientName: string,
    scheduledAt: Date,
    durationMins: number,
    priceCents: number,
    dashboardUrl: string,
  ): Promise<void> {
    const earnedCents = Math.floor(priceCents * 0.85);
    const earnedStr = (earnedCents / 100).toFixed(2);
    const dateStr = scheduledAt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const timeStr = scheduledAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    await this.send({
      to: therapistEmail,
      subject: `New booking from ${patientName}`,
      text: `Hi ${therapistName},\n\nYou have a new paid booking from ${patientName}.\n\nDate: ${dateStr}\nTime: ${timeStr}\nDuration: ${durationMins} minutes\nYou earn: $${earnedStr}\n\nView in dashboard: ${dashboardUrl}`,
      html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
<tr><td style="background:linear-gradient(135deg,#0A2342,#1a3a6b);padding:32px;text-align:center;">
  <span style="color:white;font-size:20px;font-weight:700;">24Therapy.ai</span>
</td></tr>
<tr><td style="padding:40px 48px;">
  <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0A2342;">New booking from ${patientName}</h1>
  <p style="margin:0 0 24px;color:#64748b;">Hi ${therapistName}, a patient has booked and paid for a session.</p>
  <table cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px;background:#f8fafc;border-radius:12px;padding:20px;">
    <tr><td style="padding:6px 0;color:#64748b;font-size:14px;"><strong style="color:#0A2342;">Patient:</strong> ${patientName}</td></tr>
    <tr><td style="padding:6px 0;color:#64748b;font-size:14px;"><strong style="color:#0A2342;">Date:</strong> ${dateStr}</td></tr>
    <tr><td style="padding:6px 0;color:#64748b;font-size:14px;"><strong style="color:#0A2342;">Time:</strong> ${timeStr}</td></tr>
    <tr><td style="padding:6px 0;color:#64748b;font-size:14px;"><strong style="color:#0A2342;">Duration:</strong> ${durationMins} minutes</td></tr>
    <tr><td style="padding:6px 0;color:#059669;font-size:14px;"><strong>You earn: $${earnedStr}</strong> (85% of payment)</td></tr>
  </table>
  <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
    <tr><td style="border-radius:12px;background:#1F5EFF;">
      <a href="${dashboardUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;">View in Dashboard</a>
    </td></tr>
  </table>
  <p style="margin:0;color:#94a3b8;font-size:13px;">The session link has been sent to the patient. Check your dashboard for details.</p>
</td></tr>
<tr><td style="padding:24px 48px;border-top:1px solid #f1f5f9;text-align:center;">
  <p style="margin:0;color:#94a3b8;font-size:12px;">24Therapy.ai — HIPAA-compliant mental health platform</p>
</td></tr>
</table></td></tr></table>
</body></html>`,
    });
  }

  // ─── Therapist verification emails ────────────────────────────────────────

  async sendTherapistApproved(email: string, name: string): Promise<void> {
    const displayName = name || 'there';
    await this.send({
      to: email,
      subject: 'Your 24Therapy account has been approved 🎉',
      text: `Congratulations ${displayName}!\n\nYour 24Therapy account has been approved. You can now start running sessions, manage patients, and get paid.\n\nYour first session is on us — completely free.\n\nGo to your dashboard: ${this.therapistAppUrl}/dashboard`,
      html: this.buildSimpleHtml(
        `Congratulations, ${displayName}! 🎉`,
        `<p style="margin:0 0 16px;color:#64748b;line-height:1.6;">Your 24Therapy account has been <strong style="color:#059669;">approved</strong>. You now have full access to your therapist portal.</p>
         <p style="margin:0 0 16px;color:#64748b;line-height:1.6;">Start a session, manage your patients, set up your booking page, and connect your bank account to get paid — 85% of every session is yours.</p>
         <p style="margin:0 0 24px;color:#1F5EFF;line-height:1.6;font-weight:600;">🎁 Your first session is completely free.</p>`,
        { label: 'Go to Dashboard', url: `${this.therapistAppUrl}/dashboard` },
      ),
    });
  }

  async sendTherapistRejected(email: string, name: string, reason: string): Promise<void> {
    const displayName = name || 'there';
    const reasonText = reason && reason.trim().length > 0 ? reason.trim() : 'Your application did not meet our current onboarding requirements.';
    await this.send({
      to: email,
      subject: 'Update on your 24Therapy application',
      text: `Hi ${displayName},\n\nUnfortunately, we were unable to approve your 24Therapy application at this time.\n\nReason: ${reasonText}\n\nIf you believe this was a mistake or would like to provide additional information, please contact our support team at support@24therapy.ai.`,
      html: this.buildSimpleHtml(
        'Update on your application',
        `<p style="margin:0 0 16px;color:#64748b;line-height:1.6;">Hi ${displayName}, thank you for your interest in joining 24Therapy.</p>
         <p style="margin:0 0 16px;color:#64748b;line-height:1.6;">Unfortunately, we were unable to approve your application at this time.</p>
         <table cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px;background:#fef2f2;border:1px solid #fecaca;border-radius:12px;">
           <tr><td style="padding:16px;color:#991b1b;font-size:14px;line-height:1.6;"><strong>Reason:</strong> ${reasonText}</td></tr>
         </table>
         <p style="margin:0 0 24px;color:#64748b;line-height:1.6;">If you believe this was a mistake or would like to provide additional information, our support team is happy to help.</p>`,
        { label: 'Contact Support', url: 'mailto:support@24therapy.ai' },
      ),
    });
  }
}

// Reviewed: 2026-06-13 — 24Therapy audit
