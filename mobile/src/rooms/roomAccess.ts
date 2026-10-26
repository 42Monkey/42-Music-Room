import type { Room } from '@/types/api';

// Whether this user may vote or edit; place and time are checked by the server on each action
export function canTakePart(room: Room, userId: string | undefined): boolean {
	if (room.accessPolicy !== 'INVITE_ONLY') return true;
	if (!userId) return false;
	return room.ownerId === userId || (room.members ?? []).some((member) => member.userId === userId);
}
