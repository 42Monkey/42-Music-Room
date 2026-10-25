import { FriendsService } from './friends.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('FriendsService.getFriendshipState', () => {
  const prisma = { friendship: { findFirst: jest.fn() } };
  const service = new FriendsService(prisma as any);

  beforeEach(() => jest.clearAllMocks());

  it('check no row means none', async () => {
    prisma.friendship.findFirst.mockResolvedValue(null);
    expect(await service.getFriendshipState('viewer', 'other')).toBe('none');
  });

  it.each([['viewer'], ['other']])(
    'check an accepted row sent by %s means friend',
    async (sender) => {
      prisma.friendship.findFirst.mockResolvedValue({
        senderId: sender,
        status: 'ACCEPTED',
      });
      expect(await service.getFriendshipState('viewer', 'other')).toBe(
        'friend',
      );
    },
  );

  it('check a pending row sent by the viewer means sent', async () => {
    prisma.friendship.findFirst.mockResolvedValue({
      senderId: 'viewer',
      status: 'PENDING',
    });
    expect(await service.getFriendshipState('viewer', 'other')).toBe('sent');
  });

  it('check a pending row sent by the other user means received', async () => {
    prisma.friendship.findFirst.mockResolvedValue({
      senderId: 'other',
      status: 'PENDING',
    });
    expect(await service.getFriendshipState('viewer', 'other')).toBe(
      'received',
    );
  });

  it('check one query covers both directions', async () => {
    prisma.friendship.findFirst.mockResolvedValue(null);
    await service.getFriendshipState('viewer', 'other');
    expect(prisma.friendship.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.friendship.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { senderId: 'viewer', receiverId: 'other' },
          { senderId: 'other', receiverId: 'viewer' },
        ],
      },
      select: { senderId: true, status: true },
    });
  });

  it('check areFriends is true only for accepted friendships', async () => {
    prisma.friendship.findFirst.mockResolvedValueOnce({
      senderId: 'viewer',
      status: 'ACCEPTED',
    });
    expect(await service.areFriends('viewer', 'other')).toBe(true);
    prisma.friendship.findFirst.mockResolvedValueOnce({
      senderId: 'viewer',
      status: 'PENDING',
    });
    expect(await service.areFriends('viewer', 'other')).toBe(false);
  });
});

describe('FriendsService.sendRequest', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    friendship: { create: jest.fn(), findFirst: jest.fn() },
  };
  const service = new FriendsService(prisma as any);

  beforeEach(() => jest.clearAllMocks());

  it('check an unknown receiver returns 404 and nothing is created', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.sendRequest('a', 'ghost')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.friendship.create).not.toHaveBeenCalled();
  });

  it('check a unique violation returns 409 with the existing status', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'b' });
    prisma.friendship.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    prisma.friendship.findFirst.mockResolvedValue({ status: 'PENDING' });

    const err = await service.sendRequest('a', 'b').catch((e) => e);

    expect(err).toBeInstanceOf(ConflictException);
    expect(err.message).toContain('PENDING');
    expect(prisma.friendship.findFirst).toHaveBeenCalledWith({
      where: { pairKey: 'a:b' },
      select: { status: true },
    });
  });

  // the third one, because this is the idea the whole change rests on
  it.each([
    ['a', 'b'],
    ['b', 'a'],
  ])('check %s -> %s stores the same sorted pairKey', async (from, to) => {
    prisma.user.findUnique.mockResolvedValue({ id: to });
    prisma.friendship.create.mockResolvedValue({});

    await service.sendRequest(from, to);

    expect(prisma.friendship.create).toHaveBeenCalledWith({
      data: {
        senderId: from,
        receiverId: to,
        pairKey: 'a:b',
        status: 'PENDING',
      },
    });
  });
});
