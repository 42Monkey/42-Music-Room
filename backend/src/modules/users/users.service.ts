import { Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
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

  private toOwnProfile(user: User, googleLinked = false) {
    const {
      passwordHash,
      emailVerificationToken,
      emailVerificationAttempts,
      passwordResetToken,
      passwordResetExpiresAt,
      passwordResetAttempts,
      tokenVersion,
      ...safe
    } = user;
    return { ...safe, googleLinked };
  }

  private async isGoogleLinked(userId: string): Promise<boolean> {
    const count = await this.prisma.googleAccount.count({ where: { userId } });
    return count > 0;
  }

  async getOwnProfile(userId: string) {
    const user = await this.findById(userId);
    const googleLinked = await this.isGoogleLinked(userId);
    return this.toOwnProfile(user, googleLinked);
  }

  async getProfileForViewer(targetUserId: string, viewerId: string) {
    const target = await this.findById(targetUserId);

    if (targetUserId === viewerId) {
      const googleLinked = await this.isGoogleLinked(viewerId);
      return { ...this.toOwnProfile(target, googleLinked), friendship: 'self' as const };
    }

    const friendship = await this.friendsService.getFriendshipState(
      viewerId,
      targetUserId,
    );

    const publicFields = {
      id: target.id,
      displayName: target.displayName,
      bio: target.bio,
      avatarUrl: target.avatarUrl,
      musicPreference: target.musicPreference,
    };

    if (friendship === 'friend') {
      return {
        ...publicFields,
        location: target.location,
        phoneNumber: target.phoneNumber,
        friendship,
      };
    }

    return { ...publicFields, friendship };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
    });
    const googleLinked = await this.isGoogleLinked(userId);
    return this.toOwnProfile(updated, googleLinked);
  }
}
