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
import { GoogleMobileAuthDto } from './dto/google-mobile.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { UserResponseDto, AuthResponseDto, MessageResponseDto } from './dto/auth-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import type { Request } from 'express';

interface AuthenticatedUser {
  id: string;
  email: string | null;
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
  @ApiResponse({ status: 201, description: 'User registered successfully', type: UserResponseDto })
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
  @ApiResponse({ status: 200, description: 'Access token returned', type: AuthResponseDto })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({ status: 200, description: 'Authenticated user profile', type: UserResponseDto })
  me(@Req() req: Request & { user: AuthenticatedUser }) {
    return req.user;
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Get('verify-email')
  @ApiOperation({ summary: 'Verify email using a code' })
  @ApiQuery({ name: 'email', required: true, description: 'Account email' })
  @ApiQuery({ name: 'token', required: true, description: 'Verification code' })
  @ApiResponse({ status: 200, description: 'Email verified', type: MessageResponseDto })
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
    type: MessageResponseDto,
  })
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('request-password-reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset email' })
  @ApiBody({ type: RequestPasswordResetDto })
  @ApiResponse({ status: 200, description: 'Reset instructions sent', type: MessageResponseDto })
  requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with a token' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 200, description: 'Password reset successfully', type: MessageResponseDto })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Start Google OAuth login' })
  googleAuth() {}

  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @Post('google/mobile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login or signup with Google ID token from mobile app' })
  @ApiBody({ type: GoogleMobileAuthDto })
  @ApiResponse({ status: 200, description: 'Access and refresh tokens issued', type: AuthResponseDto })
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
  @ApiResponse({ status: 200, description: 'Google account linked successfully', type: MessageResponseDto })
  async googleMobileLink(
    @Req() req: Request & { user: AuthenticatedUser },
    @Body() dto: GoogleMobileAuthDto,
  ) {
    const googleProfile = await this.authService.verifyGoogleIdToken(dto.idToken);
    return this.authService.googleLinking(req.user.id, googleProfile);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange refresh token for new token pair' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 200, description: 'New refresh token issued', type: AuthResponseDto })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }
}
