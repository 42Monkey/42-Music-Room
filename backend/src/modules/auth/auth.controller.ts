import {
  Body,
  Controller,
  Get,
  Post,
  HttpCode,
  HttpStatus,
  UseGuards,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { EmailDto } from './dto/email.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import type { Request, Response } from 'express';
import { ResendVerificationDto } from './dto/resend-verification.dto';

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

  @Throttle({
    default: {
      limit: Number(process.env.LOGIN_THROTTLE_LIMIT ?? 15),
      ttl: 60000,
    },
  })
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
  me(@Req() req: Request & { user: AuthenticatedUser }) {
    return req.user;
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Get('verify-email')
  @ApiOperation({ summary: 'Verify email using a code' })
  @ApiQuery({ name: 'email', required: true, description: 'Account email' })
  @ApiQuery({ name: 'token', required: true, description: 'Verification code' })
  @ApiResponse({ status: 200, description: 'Email verified' })
  verifyEmail(@Query() dto: EmailDto) {
    return this.authService.verifyEmail(dto.email, dto.token);
  }

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sends new email verification code' })
  @ApiBody({ type: ResendVerificationDto })
  @ApiResponse({
    status: 200,
    description: 'A new code is sent if the account exists and unverified',
  })
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto);
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
  googleAuth() {}

  @Get('google/link')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Generate Google account linking URL' })
  async googleLink(
    @Req() req: Request & { user: AuthenticatedUser },
    @Res() res: Response,
  ) {
    const state = await this.authService.createGoogleLinkState(req.user.id);
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const callbackUrl = this.config.get<string>('GOOGLE_CALLBACK_URL');
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${callbackUrl}&response_type=code&scope=email%20profile&state=${state}`;
    res.redirect(url);
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Handle Google OAuth callback' })
  @ApiQuery({
    name: 'state',
    required: false,
    description: 'OAuth state payload',
  })
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

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange refresh token for new token pair' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 200, description: 'New refresh token issued' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }
}
