import { sendFriendRequest } from '@/api/friends';
import { ApiError } from '@/api/errors';

// Where the user stands with someone; 'sent' is only known for requests sent during this visit
export type Relation = 'friend' | 'received' | 'sent' | 'none';

// Sends a request; one that already exists counts as done
// (backend: "Friendship relation already exists with status: PENDING" or "...: ACCEPTED")
export async function addFriend(personId: string): Promise<'sent' | 'friend'> {
	try {
		await sendFriendRequest(personId);
		return 'sent';
	} catch (error) {
		if (error instanceof ApiError && error.status === 409) {
			return String(error.serverMessage).endsWith('ACCEPTED') ? 'friend' : 'sent';
		}
		throw error;
	}
}
