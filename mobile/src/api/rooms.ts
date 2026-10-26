import type { CreateRoomInput, Room } from '@/types/api';
import { api } from './client';

// Rooms the user can see: public, owned or invited to
export const listRooms = () => api.get<Room[]>('/rooms');

// One room, if the user is allowed to see it
export const getRoom = (roomId: string) => api.get<Room>(`/rooms/${roomId}`);

// New room, owned by the user
export const createRoom = (input: CreateRoomInput) => api.post<Room>('/rooms', input);
