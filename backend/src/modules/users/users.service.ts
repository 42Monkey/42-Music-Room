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
		const updated = await this.prisma.user.update({
			where: { id: userId },
			data: dto,
		});

		const { passwordHash, emailVerificationToken, passwordResetToken, ...safe } = updated;
		return safe;
	}
}
