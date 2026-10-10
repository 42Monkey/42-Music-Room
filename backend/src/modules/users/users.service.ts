import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FriendsService } from './friends.service';
import { UpdateProfileDto } from './dto/update.dto';

@Injectable()
export class UsersService {
  constructor(
	private prisma: PrismaService,
	private friendsService: FriendsService,
  ) {}

	async findById(id: string) {
		const user = await this.prisma.user.findUnique({ where: { id } });
			if (!user) {
				throw new NotFoundException('User not found');
			}
		return user;
	}

	async getOwnProfile(userId: string) {
		const user = await this.findById(userId);
		const { passwordHash, emailVerificationToken, passwordResetToken, ...safe } = user;
		return safe;
	}

	async getProfileForViewer(targetUserId: string, viewerId: string) {
		const target = await this.findById(targetUserId);

		const isSelf = targetUserId === viewerId;
		const isFriend = isSelf
			? false
			: await this.friendsService.areFriends(targetUserId, viewerId);

		const publicFields = {
			id: target.id,
			displayName: target.displayName,
			bio: target.bio,
			avatarUrl: target.avatarUrl,
			musicPreference: target.musicPreference,
		};

		if (isSelf) {
			return this.getOwnProfile(viewerId);
		}

		if (isFriend) {
			return {
				...publicFields,
				location: target.location,
				phoneNumber: target.phoneNumber,
			};
		}
	return publicFields;
	}

	async updateProfile(userId: string, dto: UpdateProfileDto) {
		const { birthDate, ...rest } = dto;
		const data: Record<string, any> = { ...rest };
		if (birthDate !== undefined) {
			data.birthDate = birthDate ? new Date(birthDate) : null;
		}

		const updated = await this.prisma.user.update({
			where: { id: userId },
			data,
		});

		const { passwordHash, emailVerificationToken, passwordResetToken, ...safe } = updated;
		return safe;
	}

	async searchUsers(query?: string, limit = 20) {
		const trimmed = query?.trim();
		const where = trimmed
			? {
					OR: [
						{ displayName: { contains: trimmed, mode: 'insensitive' as const } },
						{ email: { contains: trimmed, mode: 'insensitive' as const } },
					],
			  }
			: {};

		return this.prisma.user.findMany({
			where,
			take: limit,
			select: {
				id: true,
				displayName: true,
				avatarUrl: true,
				bio: true,
				musicPreference: true,
			},
		});
	}
}
