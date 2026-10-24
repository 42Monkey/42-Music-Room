import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FriendshipStatus } from '@prisma/client';

@Injectable()
export class FriendsService {
	constructor(private prisma: PrismaService) {}

	async sendRequest(currentUserId: string, receiverId: string) {
		if (currentUserId === receiverId) {
			throw new BadRequestException('You cannot send a friend request to yourself');
		}
	
		const targetUser = await this.prisma.user.findUnique({ where: { id: receiverId } });
		if (!targetUser) {
			throw new NotFoundException('User not found');
		}
	
		return this.prisma.$transaction(async (tx) => {
			// serialize concurrent requests between the same pair of users,
			// regardless of who is sender vs receiver in either call
			const [a, b] = [currentUserId, receiverId].sort();
			await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${a}), hashtext(${b}))`;
		
			const existing = await tx.friendship.findFirst({
				where: {
					OR: [
						{ senderId: currentUserId, receiverId },
						{ senderId: receiverId, receiverId: currentUserId },
					],
				},
			});
		
			if (existing) {
				throw new ConflictException(`Friendship relation already exists with status: ${existing.status}`);
			}
		
			return tx.friendship.create({
				data: {
					senderId: currentUserId,
					receiverId,
					status: FriendshipStatus.PENDING,
				},
			});
		});
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

		return friendships.map((f) => (f.senderId === userId ? f.receiver : f.sender));
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
		const friendship = await this.prisma.friendship.findFirst({
			where: {
			status: FriendshipStatus.ACCEPTED,
			OR: [
				{ senderId: userId1, receiverId: userId2 },
				{ senderId: userId2, receiverId: userId1 },
			],
		},
	});
	return !!friendship;
	}
}
