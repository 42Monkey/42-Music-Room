import { UsersService } from './users.service';

describe('UsersService.getProfileForViewer', () => {
  const target = {
    id: 'target',
    displayName: 'Monkey',
    bio: 'hi',
    avatarUrl: null,
    musicPreference: { genres: ['techno'] },
    location: 'Bangkok',
    phoneNumber: '+33 1 23',
    email: 'Monkey@test.com',
    passwordHash: 'hash',
    emailVerificationToken: '123456',
    passwordResetToken: '654321',
    passwordResetExpiresAt: null,
    emailVerificationAttempts: 0,
    passwordResetAttempts: 0,
    tokenVersion: 3,
  };
  const prisma = {
    user: { findUnique: jest.fn() },
    googleAccount: { count: jest.fn().mockResolvedValue(0) },
  };
  const friends = { getFriendshipState: jest.fn() };
  const service = new UsersService(prisma as any, friends as any);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(target);
    prisma.googleAccount.count.mockResolvedValue(0);
  });

  it('check your own profile is marked self without touching friendships', async () => {
    const res = await service.getProfileForViewer('target', 'target');
    expect(res.friendship).toBe('self');
    expect(res).toHaveProperty('googleLinked');
    expect(friends.getFriendshipState).not.toHaveBeenCalled();
  });

  it.each([
    'passwordHash',
    'emailVerificationToken',
    'emailVerificationAttempts',
    'passwordResetToken',
    'passwordResetExpiresAt',
    'passwordResetAttempts',
    'tokenVersion',
  ])('check your own profile never contains %s', async (field) => {
    const res = await service.getProfileForViewer('target', 'target');
    expect(res).not.toHaveProperty(field);
  });

  it('check a friend sees contact details and friendship friend', async () => {
    friends.getFriendshipState.mockResolvedValue('friend');
    const res = await service.getProfileForViewer('target', 'viewer');
    expect(res).toMatchObject({
      friendship: 'friend',
      location: 'Bangkok',
      phoneNumber: '+33 1 23',
    });
  });

  it.each(['sent', 'received', 'none'])(
    'check %s shows public fields only',
    async (state) => {
      friends.getFriendshipState.mockResolvedValue(state);
      const res = await service.getProfileForViewer('target', 'viewer');
      expect(res.friendship).toBe(state);
      expect(res).not.toHaveProperty('location');
      expect(res).not.toHaveProperty('phoneNumber');
      expect(res).not.toHaveProperty('email');
    },
  );

  it('check own profile includes googleLinked: true when a Google account is linked', async () => {
    prisma.googleAccount.count.mockResolvedValue(1);
    const res = await service.getOwnProfile('target');
    expect(res).toHaveProperty('googleLinked', true);
    expect(prisma.googleAccount.count).toHaveBeenCalledWith({ where: { userId: 'target' } });
  });

  it('check own profile includes googleLinked: false when no Google account is linked', async () => {
    prisma.googleAccount.count.mockResolvedValue(0);
    const res = await service.getOwnProfile('target');
    expect(res).toHaveProperty('googleLinked', false);
  });
});
