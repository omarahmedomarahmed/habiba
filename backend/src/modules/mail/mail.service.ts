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
      this.logger.log(`[DEV EMAIL] To: ${opts.to} | Subject: ${opts.subject}`);
      this.logger.log(`[DEV EMAIL] Body: ${opts.text || opts.html.replace(/<[^>]+>/g, ' ')}`);
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
}
