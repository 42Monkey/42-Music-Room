import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MembersService {
  constructor(private prisma: PrismaService) {}

  private async assertIsOwner(roomId: string, userId: string) {
	const room = await this.prisma.room.findUnique({ where: { id: roomId } });
	if (!room) {
	  throw new NotFoundException('Room not found');
	}
	if (room.ownerId !== userId) {
	  throw new ForbiddenException('Only the owner can manage members');
	}
	return room;
  }

  async invite(roomId: string, requesterId: string, targetUserId: string) {
	await this.assertIsOwner(roomId, requesterId);

	const targetUser = await this.prisma.user.findUnique({ where: { id: targetUserId } });
	if (!targetUser) {
	  throw new NotFoundException('User to invite not found');
	}

	const existing = await this.prisma.roomMember.findUnique({
	  where: { roomId_userId: { roomId, userId: targetUserId } },
	});
	if (existing) {
	  throw new ConflictException('User is already a member of this room');
	}

	return this.prisma.roomMember.create({
	  data: { roomId, userId: targetUserId },
	});
  }

  async remove(roomId: string, requesterId: string, targetUserId: string) {
	await this.assertIsOwner(roomId, requesterId);

	const membership = await this.prisma.roomMember.findUnique({
	  where: { roomId_userId: { roomId, userId: targetUserId } },
	});
	if (!membership) {
	  throw new NotFoundException('User is not a member of this room');
	}

	return this.prisma.roomMember.delete({
	  where: { roomId_userId: { roomId, userId: targetUserId } },
	});
  }

  async listMembers(roomId: string, requesterId: string) {
	const room = await this.prisma.room.findUnique({ where: { id: roomId } });
	if (!room) {
	  throw new NotFoundException('Room not found');
	}

	const isOwner = room.ownerId === requesterId;
	const isMember = await this.prisma.roomMember.findUnique({
	  where: { roomId_userId: { roomId, userId: requesterId } },
	});

	if (!isOwner && !isMember) {
	  throw new ForbiddenException('You do not have access to this room');
	}

	return this.prisma.roomMember.findMany({
	  where: { roomId },
	  include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
	});
  }
}
