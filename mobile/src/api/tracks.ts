import type { Track } from '@/types/api';
import { api } from './client';

// Tracks of a room: by votes (VOTE) or by position (PLAYLIST)
export const listTracks = (roomId: string) => api.get<Track[]>(`/rooms/${roomId}/tracks`);
