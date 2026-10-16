import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class RoomVisibilityGuard implements CanActivate {
	constructor(private prisma: PrismaService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const req = context.switchToHttp().getRequest();
		const userId: string = req.user.id;
		const roomId: string = req.params.roomId;

		const room = await this.prisma.room.findUnique({ where: { id: roomId } });
		if (!room) {
			throw new NotFoundException('Room not found');
		}

		const isOwner = room.ownerId === userId;

		if (room.visibility === 'PRIVATE' && !isOwner) {
			const membership = await this.prisma.roomMember.findUnique({
				where: { roomId_userId: { roomId, userId } },
			});
			if (!membership) {
				throw new NotFoundException('Room not found');
			}
		}

		req.room = room;
		return true;
	}
}
