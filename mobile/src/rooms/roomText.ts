import type { Room } from '@/types/api';

// Room type in plain words
export function kindLabel(room: Pick<Room, 'kind'>): string {
	return room.kind === 'VOTE' ? 'Track vote' : 'Playlist';
}

// 224000 -> "3:44"
export function formatDuration(ms: number | null): string {
	if (!ms) return '';
	const seconds = Math.round(ms / 1000);
	return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

// Who can take part, in plain words
export function ruleLabel(room: Pick<Room, 'kind' | 'accessPolicy'>): string {
	const verb = room.kind === 'VOTE' ? 'vote' : 'edit';
	if (room.accessPolicy === 'INVITE_ONLY') return `Invited people can ${verb}`;
	if (room.accessPolicy === 'RESTRICTED') return 'Only at its place and time';
	return `Anyone can ${verb}`;
}
