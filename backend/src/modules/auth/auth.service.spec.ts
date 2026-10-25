import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    googleAccount: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };
  const mail = {
    sendVerificationEmail: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
  };
  const jwt = {
    signAsync: jest.fn().mockResolvedValue('signed-token'),
    verifyAsync: jest.fn(), // NEW
  };
  const config = { get: jest.fn().mockReturnValue('15m') };

  beforeEach(() => {
    jest.clearAllMocks();
    jwt.signAsync.mockResolvedValue('signed-token');
    config.get.mockReturnValue('15m');

    service = new AuthService(prisma as any, jwt as any, mail as any, config as any);
  });

  describe('resendVerification (#1)', () => {
    const unverifiedUser = {
      id: 'u1',
      email: 'mia@test.com',
      emailVerified: false,
    };

    it('check a new 6-digit code is saved, attempts reset to 0, and email sent for an unverified user', async () => {
      prisma.user.findUnique.mockResolvedValue(unverifiedUser);

      await service.resendVerification({ email: 'mia@test.com' });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: {
          emailVerificationToken: expect.stringMatching(/^\d{6}$/),
          emailVerificationAttempts: 0,
        },
      });

      const savedCode =
        prisma.user.update.mock.calls[0][0].data.emailVerificationToken;
      expect(mail.sendVerificationEmail).toHaveBeenCalledWith(
        'mia@test.com',
        savedCode,
      );
    });

    it('check nothing is sent or saved when the email does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await service.resendVerification({ email: 'ghost@test.com' });

      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(mail.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('check nothing is sent or saved when the account is already verified', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...unverifiedUser,
        emailVerified: true,
      });

      await service.resendVerification({ email: 'mia@test.com' });

      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(mail.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('check the response is identical for unknown, verified and unverified accounts', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      const unknown = await service.resendVerification({
        email: 'ghost@test.com',
      });

      prisma.user.findUnique.mockResolvedValueOnce({
        ...unverifiedUser,
        emailVerified: true,
      });
      const verified = await service.resendVerification({
        email: 'mia@test.com',
      });

      prisma.user.findUnique.mockResolvedValueOnce(unverifiedUser);
      const unverified = await service.resendVerification({
        email: 'mia@test.com',
      });

      expect(verified).toEqual(unknown);
      expect(unverified).toEqual(unknown);
    });
  });

  describe('requestPasswordReset (#7)', () => {
    it('check the attempts counter is reset to 0 when a new reset code is issued', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'mia@test.com',
        passwordResetAttempts: 3,
      });

      await service.requestPasswordReset({ email: 'mia@test.com' });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: expect.objectContaining({ passwordResetAttempts: 0 }),
      });
      expect(mail.sendPasswordResetEmail).toHaveBeenCalled();
    });

    it('check nothing is saved when the email does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await service.requestPasswordReset({ email: 'ghost@test.com' });

      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(mail.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe('googleLogin (#4)', () => {
    const profile = {
      googleId: 'g1',
      email: 'mia@test.com',
      displayName: 'Mia',
    };

    it('check a brand new user is created as verified', async () => {
      prisma.googleAccount.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'u1', email: profile.email });

      const tokens = await service.googleLogin(profile);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: { email: profile.email, displayName: 'Mia', emailVerified: true },
      });
      expect(tokens).toHaveProperty('accessToken');
    });

    it('check an unverified account is marked verified, its password is cleared and its sessions are ended', async () => {
      prisma.googleAccount.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: profile.email,
        emailVerified: false,
        passwordHash: 'attacker-chosen-hash',
      });
      prisma.user.update.mockResolvedValue({
        id: 'u1',
        email: profile.email,
        emailVerified: true,
        passwordHash: null,
      });

      await service.googleLogin(profile);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: expect.objectContaining({
          emailVerified: true,
          passwordHash: null,
          emailVerificationToken: null,
          passwordResetToken: null,
          tokenVersion: { increment: 1 }, // NEW
        }),
      });
      expect(prisma.googleAccount.create).toHaveBeenCalledWith({
        data: { googleId: 'g1', userId: 'u1' },
      });
    });

    it('check an already verified account keeps its password and is only linked', async () => {
      prisma.googleAccount.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: profile.email,
        emailVerified: true,
        passwordHash: 'real-hash',
      });

      await service.googleLogin(profile);

      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.googleAccount.create).toHaveBeenCalledWith({
        data: { googleId: 'g1', userId: 'u1' },
      });
    });

    it('check a returning google account logs in without touching the user table', async () => {
      prisma.googleAccount.findUnique.mockResolvedValue({
        user: { id: 'u1', email: profile.email },
      });

      const tokens = await service.googleLogin(profile);

      expect(tokens).toHaveProperty('refreshToken');
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  // NEW BLOCK
  describe('session invalidation (#6)', () => {
    const email = 'mia@test.com';
    const resettableUser = {
      id: 'u1',
      email,
      passwordResetToken: '123456',
      passwordResetExpiresAt: new Date(Date.now() + 60_000),
      passwordResetAttempts: 0,
    };

    it('check a successful password reset bumps tokenVersion', async () => {
      prisma.user.findUnique.mockResolvedValue(resettableUser);

      await service.resetPassword({
        email,
        token: '123456',
        newPassword: 'newpassword123',
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: expect.objectContaining({
          tokenVersion: { increment: 1 },
          passwordResetToken: null,
        }),
      });
    });

    it('check a wrong reset code does not bump tokenVersion', async () => {
      prisma.user.findUnique.mockResolvedValue(resettableUser);

      await expect(
        service.resetPassword({
          email,
          token: '000000',
          newPassword: 'newpassword123',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { passwordResetAttempts: 1 },
      });
    });

    it('check validateUser rejects a token issued before the reset', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email,
        role: 'USER',
        tokenVersion: 1,
      });

      await expect(
        service.validateUser({ sub: 'u1', email, tv: 0 }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('check validateUser accepts a token with the current version', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email,
        role: 'USER',
        tokenVersion: 1,
      });

      await expect(
        service.validateUser({ sub: 'u1', email, tv: 1 }),
      ).resolves.toEqual({
        id: 'u1',
        email,
        role: 'USER',
      });
    });

    it('check validateUser accepts an old token without tv while the version is still 0', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email,
        role: 'USER',
        tokenVersion: 0,
      });

      await expect(
        service.validateUser({ sub: 'u1', email }),
      ).resolves.toBeDefined();
    });

    it('check refreshTokens rejects a refresh token issued before the reset', async () => {
      jwt.verifyAsync.mockResolvedValue({
        sub: 'u1',
        email,
        type: 'refresh',
        tv: 0,
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email,
        tokenVersion: 1,
      });

      await expect(service.refreshTokens('old-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('check new tokens carry the current tokenVersion', async () => {
      jwt.verifyAsync.mockResolvedValue({
        sub: 'u1',
        email,
        type: 'refresh',
        tv: 2,
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email,
        tokenVersion: 2,
      });

      await service.refreshTokens('good-token');

      expect(jwt.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'access', tv: 2 }),
        expect.anything(),
      );
      expect(jwt.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'refresh', tv: 2 }),
        expect.anything(),
      );
    });
  });
});
