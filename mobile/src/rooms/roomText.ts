import type { Room } from '@/types/api';

// Room type in plain words
export function kindLabel(room: Pick<Room, 'kind'>): string {
	return room.kind === 'VOTE' ? 'Track vote' : 'Playlist';
}

// Who can take part, in plain words
export function ruleLabel(room: Pick<Room, 'kind' | 'accessPolicy'>): string {
	const verb = room.kind === 'VOTE' ? 'vote' : 'edit';
	if (room.accessPolicy === 'INVITE_ONLY') return `Invited people can ${verb}`;
	if (room.accessPolicy === 'RESTRICTED') return 'Only at its place and time';
	return `Anyone can ${verb}`;
}
