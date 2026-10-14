import type { Position, Track, TrackResult } from '@/types/api';
import { api } from './client';

// "?a=1&b=2" from the parts that are set
function query(params: Record<string, string | number | undefined>): string {
	const parts = Object.entries(params)
		.filter(([, value]) => value !== undefined)
		.map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`);
	return parts.length ? `?${parts.join('&')}` : '';
}

// Place-and-time rooms need the phone's position on every call
const near = (position?: Position | null) => ({ lat: position?.lat, lng: position?.lng });

// Tracks of a room: by votes (VOTE) or by position (PLAYLIST)
export const listTracks = (roomId: string, position?: Position | null) =>
	api.get<Track[]>(`/rooms/${roomId}/tracks${query(near(position))}`);

// Deezer search, through the room so its rules apply
export const searchTracks = (roomId: string, text: string, position?: Position | null) =>
	api.get<TrackResult[]>(`/rooms/${roomId}/tracks/search${query({ query: text, ...near(position) })}`);

export const addTrack = (roomId: string, deezerTrackId: string, position?: Position | null) =>
	api.post<Track>(`/rooms/${roomId}/tracks${query(near(position))}`, { deezerTrackId });

export const voteTrack = (roomId: string, trackId: string, position?: Position | null) =>
	api.post<unknown>(`/rooms/${roomId}/tracks/${trackId}/vote${query(near(position))}`);

export const unvoteTrack = (roomId: string, trackId: string, position?: Position | null) =>
	api.delete<unknown>(`/rooms/${roomId}/tracks/${trackId}/vote${query(near(position))}`);
