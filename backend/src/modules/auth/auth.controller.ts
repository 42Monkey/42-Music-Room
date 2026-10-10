import { Body, Controller, Get, Post, HttpCode, HttpStatus, UseGuards, Query, Req, Res } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config'
import { Throttle} from '@nestjs/throttler'
import { AuthService } from './auth.service'
import { RegisterDto } from './dto/register.dto'
import { LoginDto} from './dto/login.dto'
import { RequestPasswordResetDto } from './dto/request-password-reset.dto'
import { ResetPasswordDto } from './dto/reset-password.dto'
import { GoogleMobileAuthDto } from './dto/google-mobile.dto'
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard'
import type { Request,Response } from 'express';

interface AuthenticatedUser {
	id: string;
	email: string | null;
}

interface GoogleUser {
	email: string;
	displayName: string;
	googleId: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
	constructor(
		private authService: AuthService,
		private config: ConfigService,
	) {}

	@Throttle({ default: { limit: 10, ttl: 60000 } })
	@Post('register')
	@ApiOperation({ summary: 'Register a new user' })
	@ApiBody({ type: RegisterDto })
	@ApiResponse({ status: 201, description: 'User registered successfully' })
	register(@Body() dto: RegisterDto) {
		return this.authService.register(dto);
	}

	@Throttle({ default: { limit: 15, ttl: 60000 } })
	@Post('login')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Log in an existing user' })
	@ApiBody({ type: LoginDto })
	@ApiResponse({ status: 200, description: 'Access token returned' })
	login(@Body() dto: LoginDto) {
		return this.authService.login(dto);
	}

	// testing JWT strategy and guard
	@UseGuards(JwtAuthGuard)
	@Get('me')
	@ApiBearerAuth('access-token')
	@ApiOperation({ summary: 'Get current authenticated user' })
	@ApiResponse({ status: 200, description: 'Authenticated user profile' })
	me(@Req() req: Request & { user: AuthenticatedUser}) {
		return req.user;
	}

	@Get('verify-email')
	@ApiOperation({ summary: 'Verify email using a token' })
	@ApiQuery({ name: 'token', required: true, description: 'Verification token' })
	@ApiResponse({ status: 200, description: 'Email verified' })
	verifyEmail(@Query('token') token: string) {
		return this.authService.verifyEmail(token);
	}

	@Throttle({ default: { limit: 5, ttl: 60000 } })
	@Post('request-password-reset')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Request a password reset email' })
	@ApiBody({ type: RequestPasswordResetDto })
	@ApiResponse({ status: 200, description: 'Reset instructions sent' })
	requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
		return this.authService.requestPasswordReset(dto);
	}

	@Throttle({ default: { limit: 5, ttl: 60000 } })
	@Post('reset-password')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Reset password with a token' })
	@ApiBody({ type: ResetPasswordDto })
	@ApiResponse({ status: 200, description: 'Password reset successfully' })
	resetPassword(@Body() dto: ResetPasswordDto) {
		return this.authService.resetPassword(dto);
	}

	@Get('google')
	@UseGuards(GoogleAuthGuard)
	@ApiOperation({ summary: 'Start Google OAuth login' })
	googleAuth() {
	}

	@Get('google/link')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth('access-token')
	@ApiOperation({ summary: 'Generate Google account linking URL' })
	async googleLink( @Req() req: Request & { user: AuthenticatedUser }, @Res() res: Response) {
		const state = await this.authService.createGoogleLinkState(req.user.id);
		const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
		const callbackUrl = this.config.get<string>('GOOGLE_CALLBACK_URL');
		const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${callbackUrl}&response_type=code&scope=email%20profile&state=${state}`;
		res.redirect(url);
	}

	@Get('google/callback')
	@UseGuards(GoogleAuthGuard)
	@ApiOperation({ summary: 'Handle Google OAuth callback' })
	@ApiQuery({ name: 'state', required: false, description: 'OAuth state payload' })
	async googleCallback(
		@Req() req: Request & { user: GoogleUser },
		@Res() res: Response,
		@Query('state') state?: string,
	) {
		if (state) {
			const userId = await this.authService.verifyGoogleLinkState(state);
			const result = await this.authService.googleLinking(userId, req.user);
			return res.json(result);
		}
		const tokens = await this.authService.googleLogin(req.user);
		res.json(tokens);
	}

	@Throttle({ default: { limit: 15, ttl: 60000 } })
	@Post('google/mobile')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Login or signup with Google ID token from mobile app' })
	@ApiBody({ type: GoogleMobileAuthDto })
	@ApiResponse({ status: 200, description: 'Access and refresh tokens issued' })
	async googleMobileLogin(@Body() dto: GoogleMobileAuthDto) {
		const googleProfile = await this.authService.verifyGoogleIdToken(dto.idToken);
		return this.authService.googleLogin(googleProfile);
	}

	@Throttle({ default: { limit: 10, ttl: 60000 } })
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth('access-token')
	@Post('google/link')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Link Google account to authenticated user using Google ID token' })
	@ApiBody({ type: GoogleMobileAuthDto })
	@ApiResponse({ status: 200, description: 'Google account linked successfully' })
	async googleMobileLink(
		@Req() req: Request & { user: AuthenticatedUser },
		@Body() dto: GoogleMobileAuthDto,
	) {
		const googleProfile = await this.authService.verifyGoogleIdToken(dto.idToken);
		return this.authService.googleLinking(req.user.id, googleProfile);
	}
}
