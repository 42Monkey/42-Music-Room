import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { acceptFriendRequest, listFriendRequests } from '@/api/friends';
import { getUser } from '@/api/users';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ErrorState } from '@/feedback/ErrorState';
import { useFeedback } from '@/feedback/FeedbackProvider';
import { addFriend, type Relation } from '@/friends/relation';
import { ProfileView, type SeenAs } from '@/profile/ProfileView';
import { useSession } from '@/session/SessionProvider';
import { colors, space, type } from '@/theme';
import type { Profile } from '@/types/api';

// TODO: use the backend's friendship field once GET /users/:id has it (asked Tony).
// Until then: contact details only come back for friends.
function seenAsFor(profile: Profile, myId: string | undefined): SeenAs {
	if (profile.id === myId) return 'self';
	return 'location' in profile ? 'friend' : 'other';
}

type Person = { profile: Profile; seenAs: SeenAs; relation: Relation };

// Someone's profile, opened from the friends list or the search; loaded fresh each time
export default function PersonScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const { user } = useSession();
	const { showError } = useFeedback();
	const [person, setPerson] = useState<Person | null>(null);
	const [error, setError] = useState<unknown>(null);
	const [busy, setBusy] = useState(false);

	// Profile, plus my incoming requests to know if this person sent me one
	const load = useCallback(async () => {
		setError(null);
		try {
			const [profile, requests] = await Promise.all([getUser(String(id)), listFriendRequests()]);
			const seenAs = seenAsFor(profile, user?.id);
			let relation: Relation = 'none';
			if (seenAs === 'friend') relation = 'friend';
			else if (requests.some((request) => request.senderId === profile.id)) relation = 'received';
			setPerson((current) => ({
				profile,
				seenAs,
				// A request sent during this visit is not in any list
				relation: relation === 'none' && current?.relation === 'sent' ? 'sent' : relation,
			}));
		} catch (err) {
			setError(err);
		}
	}, [id, user?.id]);

	useEffect(() => {
		load();
	}, [load]);

	// Add or accept; accepting reloads the profile, now with contact details
	const act = async () => {
		if (!person) return;
		setBusy(true);
		try {
			if (person.relation === 'received') {
				await acceptFriendRequest(person.profile.id);
				await load();
			} else {
				const next = await addFriend(person.profile.id);
				if (next === 'friend') await load();
				else setPerson({ ...person, relation: 'sent' });
			}
		} catch (err) {
			showError(err);
		} finally {
			setBusy(false);
		}
	};

	return (
		<Screen back={{ label: 'Back', onPress: () => router.back() }}>
			{error ? (
				<ErrorState error={error} onRetry={load} />
			) : person === null ? (
				<ActivityIndicator color={colors.accent} style={styles.loading} />
			) : (
				<ProfileView
					user={person.profile}
					seenAs={person.seenAs}
					action={person.seenAs !== 'self' && <FriendAction relation={person.relation} busy={busy} onPress={act} />}
				/>
			)}
		</Screen>
	);
}

// Add friend / Accept, or where things stand (there is no unfriend yet)
function FriendAction({ relation, busy, onPress }: { relation: Relation; busy: boolean; onPress: () => void }) {
	if (relation === 'friend' || relation === 'sent') {
		return (
			<View style={styles.status}>
				<Ionicons name={relation === 'friend' ? 'people' : 'checkmark'} size={18} color={colors.live} />
				<Text style={styles.statusText}>{relation === 'friend' ? 'Friends' : 'Request sent'}</Text>
			</View>
		);
	}
	return (
		<Button
			label={relation === 'received' ? 'Accept friend request' : 'Add friend'}
			icon={relation === 'received' ? 'checkmark' : 'person-add'}
			loading={busy}
			onPress={onPress}
		/>
	);
}

const styles = StyleSheet.create({
	loading: {
		marginTop: space.huge,
	},
	status: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: space.sm,
		minHeight: 44,
	},
	statusText: {
		...type.headline,
		color: colors.live,
	},
});
