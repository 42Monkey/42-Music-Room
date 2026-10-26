import type { RoomMember } from '@/types/api';
import { api } from './client';

// Invited people of a room (owner and members only)
export const listMembers = (roomId: string) => api.get<RoomMember[]>(`/rooms/${roomId}/members`);

export const inviteMember = (roomId: string, userId: string) =>
	api.post<RoomMember>(`/rooms/${roomId}/members`, { userId });

// Owner takes an invite back
export const removeMember = (roomId: string, userId: string) => api.delete<unknown>(`/rooms/${roomId}/members/${userId}`);
