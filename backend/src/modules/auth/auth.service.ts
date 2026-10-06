import { ConflictException, UnauthorizedException, BadRequestException, Injectable } from "@nestjs/common";
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../../prisma/prisma.service";
import { MailService } from "./mail.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { RequestPasswordResetDto } from "./dto/request-password-reset.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";

@Injectable()
export class AuthService {
	constructor(
		private prisma: PrismaService,
		private jwt: JwtService,
		private mail: MailService,
	) {}

	async register(dto: RegisterDto) {
		const existing = await this.prisma.user.findUnique({
			where: { email: dto.email },
		});

		if (existing) {
			throw new ConflictException('Email already in use');
		}

		const passwordHash = await argon2.hash(dto.password);
		const verificationToken = crypto.randomBytes(32).toString('hex');

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

	async verifyEmail(token: string) {
		const user = await this.prisma.user.findFirst({
			where: { emailVerificationToken: token },
		});

		if (!user) {
			throw new BadRequestException('Invalid or expired verification token');
		}

		await this.prisma.user.update({
			where: { id: user.id },
			data: {
				emailVerified: true,
				emailVerificationToken: null,
			},
		});

		return { message: 'Email verified succesfully'};
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

		return this.issueTokens(user.id, user.email);
	}

	private async issueTokens(userId: string, email: string | null) {
		const payload = { sub: userId, email };

		const accessToken = await this.jwt.signAsync(payload, {
			expiresIn: '15m',
		});

		const refreshToken = await this.jwt.signAsync(payload, {
			expiresIn: '7d',
		});

		return { accessToken, refreshToken };
	}

	async requestPasswordReset(dto: RequestPasswordResetDto) {
		const user = await this.prisma.user.findUnique({
			where: { email: dto.email },
		})

		const message = 'If that email exists, a reset link has been sent.'

		if (!user) {
			return { message };
		}

		const resetToken = crypto.randomBytes(32).toString('hex');
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
		const user = await this.prisma.user.findFirst({
			where: { passwordResetToken: dto.token },
		});

		if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
			throw new BadRequestException('Invalid or expired reset token');
		}

		const passwordHash = await argon2.hash(dto.newPassword);

		await this.prisma.user.update({
			where: { id: user.id },
			data: {
				passwordHash,
				passwordResetToken: null,
				passwordResetExpiresAt: null,
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
}
