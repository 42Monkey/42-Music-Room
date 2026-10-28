import { Test, TestingModule } from '@nestjs/testing';
import { RoomsGateway } from './rooms.gateway';
import { RoomsService } from './rooms.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../auth/auth.service';
import { Server, Socket } from 'socket.io';

describe('RoomsGateway', () => {
  let gateway: RoomsGateway;
  let roomsService: jest.Mocked<RoomsService>;
  let prismaService: jest.Mocked<PrismaService>;
  let eventEmitter: EventEmitter2;

  const mockServer = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  } as unknown as Server;

  const mockSocket = {
    id: 'socket-123',
    join: jest.fn(),
    leave: jest.fn(),
    handshake: {
      headers: {},
      address: '127.0.0.1',
    },
    user: { id: 'user-123', email: 'test@example.com', role: 'USER' },
  } as unknown as Socket & { user?: any };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomsGateway,
        {
          provide: RoomsService,
          useValue: {
            findOneVisibleTo: jest.fn().mockResolvedValue({ id: 'room-123' }),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            actionLog: {
              create: jest.fn().mockResolvedValue({}),
            },
          },
        },
        {
          provide: EventEmitter2,
          useValue: new EventEmitter2(),
        },
        {
          provide: JwtService,
          useValue: { verify: jest.fn() },
        },
        {
          provide: AuthService,
          useValue: { validateUser: jest.fn() },
        },
      ],
    }).compile();

    gateway = module.get<RoomsGateway>(RoomsGateway);
    roomsService = module.get(RoomsService);
    prismaService = module.get(PrismaService);
    eventEmitter = module.get(EventEmitter2);

    gateway.server = mockServer;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  it('should handle joining a room successfully', async () => {
    const result = await gateway.handleJoinRoom(mockSocket, { roomId: 'room-123' });

    expect(roomsService.findOneVisibleTo).toHaveBeenCalledWith('room-123', 'user-123');
    expect(mockSocket.join).toHaveBeenCalledWith('room:room-123');
    expect(result).toEqual({ event: 'joinedRoom', data: { roomId: 'room-123' } });
  });

  it('should handle leaving a room successfully', async () => {
    const result = await gateway.handleLeaveRoom(mockSocket, { roomId: 'room-123' });

    expect(mockSocket.leave).toHaveBeenCalledWith('room:room-123');
    expect(result).toEqual({ event: 'leftRoom', data: { roomId: 'room-123' } });
  });

  it('should broadcast track updates when room.tracks.updated event is emitted', () => {
    const payload = { roomId: 'room-123', tracks: [{ id: 'track-1', title: 'Song 1' }] };

    gateway.handleTracksUpdated(payload);

    expect(mockServer.to).toHaveBeenCalledWith('room:room-123');
    expect(mockServer.emit).toHaveBeenCalledWith('tracks:updated', payload.tracks);
  });
});
