import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter | null;
  private readonly from: string;

  constructor() {
    const host = process.env.MAIL_HOST;
    const port = process.env.MAIL_PORT ? parseInt(process.env.MAIL_PORT, 10) : 587;
    const user = process.env.MAIL_USER;
    const pass = process.env.MAIL_PASS;
    this.from = process.env.MAIL_FROM || user || 'no-reply@volus.app';

    if (!host || !user || !pass) {
      this.logger.warn(
        'Mail transport not configured (missing MAIL_HOST/MAIL_USER/MAIL_PASS) — emails will be skipped.',
      );
      this.transporter = null;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }

  /** Sends an HTML email. Returns false (without throwing) if transport is unconfigured or the send fails. */
  async sendMail(to: string, subject: string, html: string): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn(`Skipped email to ${to} — mail transport not configured`);
      return false;
    }

    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
      return true;
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}: ${err}`);
      return false;
    }
  }
}
