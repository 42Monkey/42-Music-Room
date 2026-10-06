import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRoomDto } from './dto/create.dto';
import { UpdateRoomDto } from './dto/update.dto';

@Injectable()
export class RoomsService {
	constructor(private prisma: PrismaService) {}

	async create(userId: string, dto: CreateRoomDto) {
		return this.prisma.room.create({
			data: {
				...dto,
				ownerId: userId,
			},
		});
	}

	async findAllVisibleTo(userId: string) {
		return this.prisma.room.findMany({
			where: {
				OR: [
					{ visibility: 'PUBLIC' },
					{ ownerId: userId },
					{ members: { some: { userId }}},
				],
			},
		});
	}

	async findOne(id: string) {
		const room = await this.prisma.room.findUnique({
			where: { id },
			include: { members: true },
		});
		if (!room) {
			throw new NotFoundException('Room not found');
		}
		return room;
	}

	async findOneVisibleTo(id: string, userId: string) {
		const room = await this.findOne(id);

		const isOwner = room.ownerId === userId;
		const isPublic = room.visibility === 'PUBLIC';
		const isMember = room.members.some((m) => m.userId === userId);

		if (!isPublic && !isOwner && !isMember) {
			throw new NotFoundException('Room not found');
		}

		return room;
	}

	async update(id: string, userId: string, dto: UpdateRoomDto) {
		const room = await this.findOne(id);
		if (room.ownerId !== userId) {
			throw new ForbiddenException('Only the owner can update this room');
		}

		return this.prisma.room.update({
			where: { id },
			data: dto,
		});
	}

	async remove(id: string, userId: string) {
		const room = await this.findOne(id);
		if (room.ownerId !== userId) {
			throw new ForbiddenException('Only the owner can delete this room');
		}

		return this.prisma.room.delete({
			where: { id },
		});
	}
}
