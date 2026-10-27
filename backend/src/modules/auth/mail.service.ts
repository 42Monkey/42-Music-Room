import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, * as nodemail from 'nodemailer';

@Injectable()
export class MailService {
  private transporter;

  constructor(private config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST'),
      port: this.config.get<number>('SMTP_PORT'),
      secure: false, // Mailhog doesnt use TLS
    });
  }

  async sendVerificationEmail(to: string, token: string) {
    await this.transporter.sendMail({
      from: this.config.get<string>('SMTP_FROM'),
      to,
      subject: 'Verify your Music Room account',
      html: `<p>Your verification code is: ${token}</p>`,
    });
  }

  async sendPasswordResetEmail(to: string, token: string) {
    await this.transporter.sendMail({
      from: this.config.get<string>('SMTP_FROM'),
      to,
      subject: 'Reset your Music Room password',
      html: `<p>Your password reset code is: ${token}. Expires in 1 hour.</p>`,
    });
  }
}
