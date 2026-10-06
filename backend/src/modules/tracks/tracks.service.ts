import { ConflictException, Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { DeezerService } from './deezer.service';
import { handlePositionBetween } from './tracks/index.util';

@Injectable()
export class TracksService {
	constructor(
		private prisma: PrismaService,
		private deezer: DeezerService,
		private events: EventEmitter2,
	) {}

	async addTrack(roomId: string, deezerTrackId: string) {
		const room = await this.prisma.room.findUnique({ where: { id: roomId } });
		if (!room) {
			throw new NotFoundException('Room not found');
		}

		const existing = await this.prisma.track.findUnique({
			where: { roomId_providerId: { roomId, providerId: deezerTrackId } },
		});
		if (existing) {
			throw new ConflictException('This track has already been added to the room');
		}

		const metadata = await this.deezer.getTrackById(deezerTrackId);

		let position: string | null = null;
		if (room.kind === 'PLAYLIST') {
			position = await this.getNextPosition(roomId);
		}

		const track = await this.prisma.track.create({
			data: {
				roomId,
				provider: 'deezer',
				providerId: metadata.providerId,
				title: metadata.title,
				artist: metadata.artist,
				durationMs: metadata.durationMs,
				position,
			},
		});

		await this.broadcastTracks(roomId);
		return track;
	}

	async removeTrack(roomId: string, trackId: string, userId: string) {
		const room = await this.prisma.room.findUnique({ where: { id: roomId } });
		if (!room) {
			throw new NotFoundException('Room not found');
		}

		await this.checkRoomTrack(roomId, trackId);

		if (room.ownerId !== userId) {
			throw new ForbiddenException('Only the room owner can remove tracks');
		}

		await this.prisma.track.delete({ where: { id: trackId } });
		await this.broadcastTracks(roomId);
	}

	private async getNextPosition(roomId: string): Promise<string> {
		const lastTrack = await this.prisma.track.findFirst({
			where: { roomId },
			orderBy: { position: 'desc' },
		});
		return handlePositionBetween(lastTrack?.position ?? null, null);
	}

	async voteForTrack(roomId: string, trackId: string, userId: string) {
		await this.checkRoomTrack(roomId, trackId);

		const existingVote = await this.prisma.vote.findUnique({
			where: { userId_trackId: { userId, trackId } },
		});
		if (existingVote) {
			throw new ConflictException('You have already voted for this track');
		}

		const vote = await this.prisma.$transaction(async (tx) => {
			const createdVote = await tx.vote.create({
				data: { userId, trackId },
			});

			await tx.track.update({
				where: { id: trackId },
				data: { score: { increment: 1 } },
			});

			return createdVote;
		});

		await this.broadcastTracks(roomId);
		return vote;
	}

	async unvoteTrack(roomId: string, trackId: string, userId: string) {
		await this.checkRoomTrack(roomId, trackId);

		const existingVote = await this.prisma.vote.findUnique({
			where: { userId_trackId: { userId, trackId } },
		});
		if (!existingVote) {
			throw new NotFoundException('You have not voted for this track');
		}

		await this.prisma.$transaction(async (tx) => {
			await tx.vote.delete({
				where: { userId_trackId: { userId, trackId } },
			});

			await tx.track.update({
				where: { id: trackId },
				data: { score: { decrement: 1 } },
			});
		});

		await this.broadcastTracks(roomId);
	}

	async getQueue(roomId: string) {
		const room = await this.prisma.room.findUnique({ where: { id: roomId } });
		if (!room) {
			throw new NotFoundException('Room not found');
		}

		if (room.kind === "PLAYLIST") {
			return this.prisma.track.findMany({
				where: { roomId },
				orderBy: { position: 'asc'},
			});
		}

		return this.prisma.track.findMany({
			where: { roomId },
			orderBy: [
				{ score: 'desc' },
				{ addedAt: 'asc' },
			],
		});
	}

	async reorderTrack(roomId: string, trackId: string, afterTrackId: string | null, retries = 3) {
		if (trackId === afterTrackId) {
			throw new BadRequestException('Cannot move a track after itself');
		}

		await this.checkRoomTrack(roomId, trackId);

		for (let attempt = 0; attempt < retries; attempt++) {
			try {
				const { lowerPosition, upperPosition } = await this.checkBoundaries(roomId, afterTrackId);
				const newPosition = handlePositionBetween(lowerPosition, upperPosition);

				const updatedTrack = await this.prisma.track.update({
					where: { id: trackId },
					data: { position: newPosition },
				});

				await this.broadcastTracks(roomId);
				return updatedTrack;
			} catch (error: any) {
				if (error.code === 'P2002' && attempt < retries - 1) {
					continue;
				}
				throw error;
			}
		}
		throw new ConflictException('Could not resolve position collision after multiple retries');
	}

	private async checkRoomTrack(roomId: string, trackId: string) {
		const track = await this.prisma.track.findUnique({ where: { id: trackId }});
		if (!track || track.roomId !== roomId) {
			throw new NotFoundException('Track not found in this room');
		}
		return track;
	}

	private async checkBoundaries(roomId: string, afterTrackId: string | null) {
		if (!afterTrackId) {
			const firstTrack = await this.prisma.track.findFirst({
				where: { roomId },
				orderBy: { position: 'asc' }
			});
			return { lowerPosition: null, upperPosition: firstTrack?.position ?? null };
		}

		const referenceTrack = await this.checkRoomTrack(roomId, afterTrackId);
		const lowerPosition = referenceTrack.position;
		const nextTrack = await this.prisma.track.findFirst({
			where: { roomId, position: { gt: referenceTrack.position! } },
			orderBy: { position: 'asc' },
		});

		return {
			lowerPosition,
			upperPosition: nextTrack?.position ?? null
		};
	}

	private async broadcastTracks(roomId: string) {
		const tracks = await this.getQueue(roomId);
		this.events.emit('room.tracks.updated', { roomId, tracks });
	}

	async searchTracks(query: string) {
		return this.deezer.searchTracks(query);
	}

	async triggerNext(roomId: string, userId: string) {
		const room = await this.prisma.room.findUnique({ where: { id: roomId }});
		if (!room) {
			throw new NotFoundException('Room not found');
		}

		// subject is not precise about whom can trigger playback
		if (room.ownerId !== userId) {
			throw new ForbiddenException('Only the room owner can trigger playback');
		}

		this.events.emit('room.playback.next', { roomId });
		return { success: true };
	}
}
