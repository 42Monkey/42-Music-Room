import { useCallback, useEffect, useState } from 'react';
import { listTracks } from '@/api/tracks';
import type { Position, Track } from '@/types/api';
import { useSocket } from './SocketProvider';

type Options = {
	position?: Position | null;
	enabled?: boolean;
};

// Live track list of a room: loaded once, then pushed by the server
export function useRoomTracks(roomId: string, { position = null, enabled = true }: Options = {}) {
	const { socket } = useSocket();
	const [tracks, setTracks] = useState<Track[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<unknown>(null);
	const lat = position?.lat;
	const lng = position?.lng;

	const reload = useCallback(async () => {
		if (!enabled) return;
		try {
			setTracks(await listTracks(roomId, lat !== undefined && lng !== undefined ? { lat, lng } : null));
			setError(null);
		} catch (err) {
			setError(err);
		} finally {
			setLoading(false);
		}
	}, [roomId, lat, lng, enabled]);

	useEffect(() => {
		reload();
	}, [reload]);

	useEffect(() => {
		if (!socket || !enabled) return;

		const join = () => socket.emit('joinRoom', { roomId });
		// The server forgets rooms after a reconnect: join and reload again
		const onReconnect = () => {
			join();
			reload();
		};
		const onUpdate = (next: Track[]) => setTracks(next);

		if (socket.connected) join();
		socket.on('connect', onReconnect);
		socket.on('tracks:updated', onUpdate);

		return () => {
			socket.emit('leaveRoom', { roomId });
			socket.off('connect', onReconnect);
			socket.off('tracks:updated', onUpdate);
		};
	}, [socket, roomId, reload, enabled]);

	return { tracks, loading, error, reload };
}
