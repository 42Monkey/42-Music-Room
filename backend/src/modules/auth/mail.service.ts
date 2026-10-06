import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
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
		const verifyUrl = `http://localhost:8080/auth/verify-email?token=${token}`;

		await this.transporter.sendMail({
			from: this.config.get<string>('SMTP_FROM'),
			to,
			subject: 'Verifity your Music Room account',
			html: `<p> Client to verify your email: <a href="${verifyUrl}">${verifyUrl}</a></p>`,
		})
	}

	async sendPasswordResetEmail(to: string, token: string) {
		const resetUrl = `http://localhost:8080/auth/reset-password?token=${token}`;

		await this.transporter.sendMail({
			from: this.config.get<string>('SMTP_FROM'),
			to,
			subject: 'Reset your Music Room password',
			html: `<p>Click to reset your password: <a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in 1 hour.</p>`,
		});
	}
}
