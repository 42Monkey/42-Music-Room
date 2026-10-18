import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { calculateDistanceMeters } from '../utils/haversine.util';

@Injectable()
export class AccessPolicyGuard implements CanActivate {
	constructor(private prisma: PrismaService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const req = context.switchToHttp().getRequest();
		const userId: string = req.user.id;
		const roomId: string = req.params.roomId;

		const room = req.room ?? (await this.prisma.room.findUnique({ where: { id: roomId } }));
		if (!room) {
			throw new NotFoundException('Room not found');
		}

		const isOwner = room.ownerId === userId;

		switch (room.accessPolicy) {
			case 'OPEN':
				return true;

			case 'INVITE_ONLY': {
				if (isOwner) return true;
				const membership = await this.prisma.roomMember.findUnique({
					where: { roomId_userId: { roomId, userId } },
				});
				if (!membership) {
					throw new ForbiddenException('This room is invite-only');
				}
				return true;
			}

			case 'RESTRICTED': {
				if (isOwner) return true;

				// Time window check
				if (room.windowStart && room.windowEnd) {
					const now = new Date();
					if (now < room.windowStart || now > room.windowEnd) {
						throw new ForbiddenException('This room is outside its active time window');
					}
				}

				// Geofence check
				if (room.locationLat != null && room.locationLng != null && room.locationRadiusM != null) {
					const lat = parseFloat(req.query.lat);
					const lng = parseFloat(req.query.lng);

					if (isNaN(lat) || isNaN(lng)) {
						throw new BadRequestException('This room requires lat/lng query params to verify your location');
					}

					const distance = calculateDistanceMeters(lat, lng, room.locationLat, room.locationLng);
					if (distance > room.locationRadiusM) {
						throw new ForbiddenException("You are outside this room's allowed location radius");
					}
				}

				return true;
			}

			default:
				throw new ForbiddenException('Unknown access policy');
		}
	}
}
