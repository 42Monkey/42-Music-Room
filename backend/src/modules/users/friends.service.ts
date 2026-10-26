import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, FriendshipStatus } from '@prisma/client';

export type FriendshipState = 'friend' | 'sent' | 'received' | 'none';

@Injectable()
export class FriendsService {
  constructor(private prisma: PrismaService) {}

  async sendRequest(currentUserId: string, receiverId: string) {
    if (currentUserId === receiverId) {
      throw new BadRequestException(
        'You cannot send a friend request to yourself',
      );
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: receiverId },
    });
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    // Same key for A->B and B->A: the unique index rejects the second request.
    // Must match the key built in prisma/seed.ts.
    const pairKey = [currentUserId, receiverId].sort().join(':');

    try {
      return await this.prisma.friendship.create({
        data: {
          senderId: currentUserId,
          receiverId,
          pairKey,
          status: FriendshipStatus.PENDING,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const existing = await this.prisma.friendship.findFirst({
          where: { pairKey },
          select: { status: true },
        });
        throw new ConflictException(
          `Friendship relation already exists with status: ${existing?.status}`,
        );
      }
      throw e;
    }
  }

  async acceptRequest(senderId: string, currentUserId: string) {
    const friendship = await this.prisma.friendship.findFirst({
      where: {
        senderId,
        receiverId: currentUserId,
        status: FriendshipStatus.PENDING,
      },
    });

    if (!friendship) {
      throw new NotFoundException('Pending friend request not found');
    }

    return this.prisma.friendship.update({
      where: { id: friendship.id },
      data: { status: FriendshipStatus.ACCEPTED },
    });
  }

  async listFriends(userId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      include: {
        sender: { select: { id: true, displayName: true, avatarUrl: true } },
        receiver: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    return friendships.map((f) =>
      f.senderId === userId ? f.receiver : f.sender,
    );
  }

  async getPendingRequests(userId: string) {
    return this.prisma.friendship.findMany({
      where: {
        receiverId: userId,
        status: FriendshipStatus.PENDING,
      },
      include: {
        sender: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });
  }

  async areFriends(userId1: string, userId2: string): Promise<boolean> {
    return (await this.getFriendshipState(userId1, userId2)) === 'friend';
  }

  async getFriendshipState(
    viewerId: string,
    otherId: string,
  ): Promise<FriendshipState> {
    const row = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId: viewerId, receiverId: otherId },
          { senderId: otherId, receiverId: viewerId },
        ],
      },
      select: { senderId: true, status: true },
    });

    if (!row) return 'none';

    if (row.status === FriendshipStatus.ACCEPTED) return 'friend';

    return row.senderId == viewerId ? 'sent' : 'received';
  }
}