import type { Position, Track } from '@/types/api';
import { api } from './client';

// Tracks of a room: by votes (VOTE) or by position (PLAYLIST)
// Place-and-time rooms also need the phone's position
export const listTracks = (roomId: string, position?: Position | null) =>
	api.get<Track[]>(`/rooms/${roomId}/tracks${position ? `?lat=${position.lat}&lng=${position.lng}` : ''}`);
