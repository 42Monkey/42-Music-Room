import { useCallback, useEffect, useState } from 'react';
import { useSocket } from '@/socket/SocketProvider';
import type { Playback, Room, Track } from '@/types/api';

export type NowPlayingState = {
	trackId: string | null;
	// Full track when the server sent it, otherwise found in the room's list
	track: Track | null;
	startedAt: number | null;
};

const NOTHING: NowPlayingState = { trackId: null, track: null, startedAt: null };

// What the room plays: read from the room, then pushed live by the server
export function useNowPlaying(room: Room | null, reloadRoom: () => void) {
	const { socket } = useSocket();
	const [now, setNow] = useState<NowPlayingState>(NOTHING);

	useEffect(() => {
		if (!room) return;
		const startedAt = room.currentTrackStartedAt ? Date.parse(room.currentTrackStartedAt) : null;
		setNow(room.currentTrackId && startedAt !== null ? { trackId: room.currentTrackId, track: null, startedAt } : NOTHING);
	}, [room]);

	const show = useCallback((track: Track | null, startedAt: string | null) => {
		setNow(track && startedAt ? { trackId: track.id, track, startedAt: Date.parse(startedAt) } : NOTHING);
	}, []);

	useEffect(() => {
		if (!socket) return;
		const onNext = (playback: Playback) => show(playback.track, playback.startedAt);
		// After a reconnect the room may have moved on: read it again
		socket.on('playback:next', onNext);
		socket.on('connect', reloadRoom);
		return () => {
			socket.off('playback:next', onNext);
			socket.off('connect', reloadRoom);
		};
	}, [socket, show, reloadRoom]);

	return { now, show };
}
