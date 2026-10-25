import { UsersService } from './users.service';

describe('UsersService.getProfileForViewer', () => {
  const target = {
    id: 'target',
    displayName: 'Mia',
    bio: 'hi',
    avatarUrl: null,
    musicPreference: { genres: ['techno'] },
    location: 'Paris',
    phoneNumber: '+33 1 23',
    email: 'mia@test.com',
    passwordHash: 'hash',
    emailVerificationToken: '123456',
    passwordResetToken: '654321',
    passwordResetExpiresAt: null,
    emailVerificationAttempts: 0,
    passwordResetAttempts: 0,
    tokenVersion: 3,
  };
  const prisma = { user: { findUnique: jest.fn() } };
  const friends = { getFriendshipState: jest.fn() };
  const service = new UsersService(prisma as any, friends as any);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(target);
  });

  it('check your own profile is marked self without touching friendships', async () => {
    const res = await service.getProfileForViewer('target', 'target');
    expect(res.friendship).toBe('self');
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
      location: 'Paris',
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
});
