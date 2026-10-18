import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayDisconnect, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { Logger, UseGuards } from '@nestjs/common';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';
import { RoomsService } from './rooms.service';
import { PrismaService } from '../../prisma/prisma.service';

interface AuthedSocket extends Socket {
	user?: { id: string; email: string | null; role: string };
}

@WebSocketGateway({ cors: true })
export class RoomsGateway implements OnGatewayDisconnect {
	@WebSocketServer() server: Server;
	private readonly logger = new Logger(RoomsGateway.name);

	constructor(
		private roomsService: RoomsService,
		private prisma: PrismaService,
	) {}

	// check room access permission
	// adds authenticated client to the live room channel
	@UseGuards(WsJwtGuard)
	@SubscribeMessage('joinRoom')
	async handleJoinRoom(
		@ConnectedSocket() client: AuthedSocket,
		@MessageBody() data: { roomId: string },
	) {
		const userId = client.user!.id;

		// validates room visibility against permissions
		await this.roomsService.findOneVisibleTo(data.roomId, userId);

		client.join(this.channel(data.roomId));
		this.logger.log(`User ${userId} joined room ${data.roomId}`);
		await this.logAction(client, userId, 'joinRoom', data.roomId);
		return { event: 'joinedRoom', data: { roomId: data.roomId } };
	}

	// removes client from the specified room's live socket channel
	@UseGuards(WsJwtGuard)
	@SubscribeMessage('leaveRoom')
	async handleLeaveRoom(
		@ConnectedSocket() client: AuthedSocket,
		@MessageBody() data: { roomId: string },
	) {
		const userId = client.user?.id ?? null;
		client.leave(this.channel(data.roomId));
		await this.logAction(client, userId, 'leaveRoom', data.roomId);
		return { event: 'leftRoom', data: { roomId: data.roomId } };
	}

	// socket.io automatically removes a disconnect client from every room
	// nothing to do manually
	handleDisconnect() {}

	// listens to evens and broadcasts updated track queues to all clients in the room
	@OnEvent('room.tracks.updated')
	handleTracksUpdated(payload: { roomId: string; tracks: unknown[] }) {
		this.server.to(this.channel(payload.roomId)).emit('tracks:updated', payload.tracks);
	}

	// formats and returns the standard redis/socket.io channel string for a given room ID
	// Room ID : 7c57fc95-0ec0-46ee-90f4-a94b8663a71f -> room:7c57fc95-0ec0-46ee-90f4-a94b8663a71f
	private channel(roomId: string): string {
		return `room:${roomId}`;
	}

	@OnEvent('room.playback.next')
	handlePlaybackNext(payload: { roomId: string; currentTrack: unknown; startedAt: Date | null }) {
		this.server.to(this.channel(payload.roomId)).emit('playback:next', {
			track: payload.currentTrack,
			startedAt: payload.startedAt,
		});
	}

	private async logAction(client: AuthedSocket, userId: string | null, action: string, roomId: string ) {
		await this.prisma.actionLog.create({
			data: {
				userId,
				action: `WS ${action}`,
				endpoint: this.channel(roomId),
				method: 'WS',
				platform: (client.handshake.headers['x-platform'] as string) ?? null,
				device: (client.handshake.headers['x-device'] as string) ?? null,
				appVersion: (client.handshake.headers['x-app-version'] as string) ?? null,
				ipAddress: client.handshake.address ?? null,
			},
		}).catch((err) => {
			this.logger.error('Action Logs failed:', err);
		});
	}
}
