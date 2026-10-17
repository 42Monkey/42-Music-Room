import { ConflictException, UnauthorizedException, BadRequestException, Injectable, ForbiddenException } from "@nestjs/common";
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { User } from '@prisma/client';
import { JwtService, JwtSignOptions } from "@nestjs/jwt";
import { PrismaService } from "../../prisma/prisma.service";
import { MailService } from "./mail.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { RequestPasswordResetDto } from "./dto/request-password-reset.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class AuthService {
	private readonly MAX_CODE_ATTEMPTS = 5;

	constructor(
		private prisma: PrismaService,
		private jwt: JwtService,
		private mail: MailService,
		private config: ConfigService,
	) {}

	private generateVerificationCode(): string {
		return crypto.randomInt(100000, 1000000).toString();
	}

	async register(dto: RegisterDto) {
		const existing = await this.prisma.user.findUnique({
			where: { email: dto.email },
		});

		if (existing) {
			throw new ConflictException('Email already in use');
		}

		const passwordHash = await argon2.hash(dto.password);
		const verificationToken = this.generateVerificationCode();

		const user = await this.prisma.user.create({
			data: {
				email: dto.email,
				passwordHash,
				displayName: dto.displayName,
				emailVerified: false,
				emailVerificationToken: verificationToken,
			},
		});

		await this.mail.sendVerificationEmail(user.email!, verificationToken);

		return {
			id: user.id,
			email: user.email,
			displayName: user.displayName,
		};
	}

	async verifyEmail(email: string, token: string) {
			const user = await this.prisma.user.findUnique({ where: { email } });

		if (!user || !user.emailVerificationToken) {
			throw new BadRequestException('Invalid or expired verification code');
		}

		if (user.emailVerificationToken !== token) {
			await this.registerFailedEmailVerificationAttempt(user);
		}

		await this.prisma.user.update({
			where: { id: user.id },
			data: {
				emailVerified: true,
				emailVerificationToken: null,
				emailVerificationAttempts: 0,
			},
		});

		return { message: 'Email verified succesfully' };
	}

	async login(dto: LoginDto) {
		const user = await this.prisma.user.findUnique({
			where: { email: dto.email },
		});

		if (!user || !user.passwordHash) {
			throw new UnauthorizedException('Invalid credentials');
		}

		const checkPassword = await argon2.verify(user.passwordHash, dto.password);
		if (!checkPassword) {
			throw new UnauthorizedException('Invalid credentials');
		}

		if (!user.emailVerified) {
			throw new ForbiddenException('Verify your email before logging in');
		}
		return this.issueTokens(user.id, user.email);
	}

	private async issueTokens(userId: string, email: string | null) {
		const accessToken = await this.jwt.signAsync(
			{ sub: userId, email, type: 'access' },
			{ expiresIn: this.config.get<string>('JWT_EXPIRES_IN')as JwtSignOptions['expiresIn'] },
		);

		const refreshToken = await this.jwt.signAsync(
			{ sub: userId, email, type: 'refresh' },
			{ expiresIn: '7d' },
		);

		return { accessToken, refreshToken };
	}

	async refreshTokens(refreshToken: string) {
		let payload: { sub: string; email: string | null; type?: string };

		try {
			payload = await this.jwt.verifyAsync(refreshToken);
		} catch {
			throw new UnauthorizedException('Invalid or expired refresh token');
		}

		if (payload.type !== 'refresh') {
			throw new UnauthorizedException('Invalid refresh token');
		}

		const user = await this.prisma.user.findUnique({ where: { id: payload.sub }});
		if (!user) {
			throw new UnauthorizedException('User no longer exists');
		}

		return this.issueTokens(user.id, user.email);
	}

	async requestPasswordReset(dto: RequestPasswordResetDto) {
		const user = await this.prisma.user.findUnique({
			where: { email: dto.email },
		})

		const message = 'If that email exists, a reset link has been sent.'

		if (!user) {
			return { message };
		}

		const resetToken = this.generateVerificationCode();
		const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

		await this.prisma.user.update({
			where: { id: user.id },
			data: {
				passwordResetToken: resetToken,
				passwordResetExpiresAt: expiresAt,
			},
		});

		await this.mail.sendPasswordResetEmail(user.email!, resetToken);

		return { message };
	}

	async resetPassword(dto: ResetPasswordDto) {
		const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

		if ( !user || !user.passwordResetToken || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
			throw new BadRequestException('Invalid or expired reset code');
		}

		if (user.passwordResetToken !== dto.token) {
			await this.registerFailedPasswordResetAttempt(user);
		}

		const passwordHash = await argon2.hash(dto.newPassword);

		await this.prisma.user.update({
			where: { id: user.id },
			data: {
				passwordHash,
				passwordResetToken: null,
				passwordResetExpiresAt: null,
				passwordResetAttempts: 0,
			},
		});
		return { message: 'Password reset successfully' };
	}

	async googleLogin(googleProfile: { googleId: string; email: string; displayName: string}) {
		const existingGoogleAccount = await this.prisma.googleAccount.findUnique({
			where: { googleId: googleProfile.googleId },
			include: { user: true },
		});

		if (existingGoogleAccount) {
			return this.issueTokens(existingGoogleAccount.user.id, existingGoogleAccount.user.email);
		}

		let user = await this.prisma.user.findUnique({
			where: { email: googleProfile.email },
		});

		if (!user) {
			user = await this.prisma.user.create({
				data: {
					email: googleProfile.email,
					displayName: googleProfile.displayName,
					emailVerified: true,
				},
			});
		}

		await this.prisma.googleAccount.create({
			data: {
				googleId: googleProfile.googleId,
				userId: user.id,
			},
		});

		return this.issueTokens(user.id, user.email);
	}

	async googleLinking(userId: string, googleProfile: { googleId: string, email: string, }) {
		const existingLink = await this.prisma.googleAccount.findUnique({
			where: { googleId: googleProfile.googleId },
		});

		if (existingLink) {
			if (existingLink.userId === userId) {
				return { message: 'Google account already linked to this profile'};
			}
			throw new ConflictException('This Google account is already linked to a different account');
		}

		await this.prisma.googleAccount.create({
			data: {
				googleId: googleProfile.googleId,
				userId,
			},
		});

		return { message: 'Google account linked successfully'};
	}

	async validateUser(payload: { sub: string; email: string | null }) {
		const user = await this.prisma.user.findUnique({
			where: { id: payload.sub },
			});

		if (!user) {
			throw new UnauthorizedException('User no longer exists');
		}
		return { id: user.id, email: user.email, role: user.role };
	}

	async createGoogleLinkState(userId: string): Promise<string> {
		return this.jwt.signAsync(
			{ purpose: 'google-link', userId },
			{ expiresIn: '10m' },
		);
	}

	async verifyGoogleLinkState(state: string): Promise<string> {
		let payload: { purpose?: string; userId?: string };
		try {
			payload = await this.jwt.verifyAsync(state);
		} catch {
			throw new BadRequestException('Invalid or expired link request');
		}

		if (payload.purpose !== 'google-link' || !payload.userId) {
			throw new BadRequestException('Invalid link request');
		}

		return payload.userId;
	}

	private async registerFailedEmailVerificationAttempt(user: User): Promise<never> {
		const attempts = user.emailVerificationAttempts + 1;
		const lockedOut = attempts >= this.MAX_CODE_ATTEMPTS;

		await this.prisma.user.update({
			where: { id: user.id },
			data: lockedOut
				? { emailVerificationToken: null, emailVerificationAttempts: 0 }
				: { emailVerificationAttempts: attempts },
		});

		throw new BadRequestException('Invalid or expired verification code');
	}

	private async registerFailedPasswordResetAttempt(user: User): Promise<never> {
		const attempts = user.passwordResetAttempts + 1;
		const lockedOut = attempts >= this.MAX_CODE_ATTEMPTS;

		await this.prisma.user.update({
			where: { id: user.id },
			data: lockedOut
				? { passwordResetToken: null, passwordResetExpiresAt: null, passwordResetAttempts: 0 }
				: { passwordResetAttempts: attempts },
		});

		throw new BadRequestException('Invalid or expired reset code');
	}
}


