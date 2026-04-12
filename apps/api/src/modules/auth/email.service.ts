import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    this.initTransporter();
  }

  private initTransporter() {
    const host = this.config.get<string>('smtp.host');
    const user = this.config.get<string>('smtp.user');
    const pass = this.config.get<string>('smtp.pass');

    // Only initialise if SMTP credentials are present
    if (!host || !user || !pass) {
      this.logger.warn(
        'SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASS). ' +
        'Password-reset emails will be logged to console only.',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: this.config.get<number>('smtp.port') ?? 587,
      secure: false,          // STARTTLS
      auth: { user, pass },
    });

    this.logger.log(`Email service ready (host: ${host})`);
  }

  async sendPasswordReset(to: string, token: string): Promise<void> {
    const frontendUrl = this.config.get<string>('frontendUrl') ?? 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
    const from = this.config.get<string>('smtp.from') ?? 'noreply@investment-tracker.app';

    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1d4ed8">Reset your password</h2>
        <p>You requested a password reset for your Investment Tracker account.</p>
        <p>Click the button below to set a new password. The link expires in <strong>1 hour</strong>.</p>
        <a href="${resetUrl}"
           style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;
                  border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
          Reset Password
        </a>
        <p style="color:#64748b;font-size:13px">
          If you did not request this, you can safely ignore this email.<br>
          The link will expire automatically.
        </p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
        <p style="color:#94a3b8;font-size:11px">Investment Tracker · Security Team</p>
      </div>
    `;

    if (!this.transporter) {
      // Development fallback – log the link so the flow can still be tested
      this.logger.log(`[DEV] Password reset link for ${to}: ${resetUrl}`);
      return;
    }

    await this.transporter.sendMail({
      from,
      to,
      subject: 'Reset your Investment Tracker password',
      html,
    });

    this.logger.log(`Password reset email sent to ${to}`);
  }
}
