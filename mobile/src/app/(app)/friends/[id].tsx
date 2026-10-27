import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { acceptFriendRequest } from '@/api/friends';
import { getUser } from '@/api/users';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ErrorState } from '@/feedback/ErrorState';
import { useFeedback } from '@/feedback/FeedbackProvider';
import { addFriend, type Relation } from '@/friends/relation';
import { ProfileView, type SeenAs } from '@/profile/ProfileView';
import { colors, space, type } from '@/theme';
import type { Friendship, Profile } from '@/types/api';

// Which parts of the profile to show: contact details come back for friends only
function seenAsFor(friendship: Friendship): SeenAs {
	if (friendship === 'self') return 'self';
	return friendship === 'friend' ? 'friend' : 'other';
}

// Someone's profile, opened from the friends list or the search; loaded fresh each time.
// The backend says where the user stands with them (friendship)
export default function PersonScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const { showError } = useFeedback();
	const [profile, setProfile] = useState<Profile | null>(null);
	const [error, setError] = useState<unknown>(null);
	const [busy, setBusy] = useState(false);

	const load = useCallback(async () => {
		setError(null);
		try {
			setProfile(await getUser(String(id)));
		} catch (err) {
			setError(err);
		}
	}, [id]);

	useEffect(() => {
		load();
	}, [load]);

	// Add or accept, then reload: the backend has the new state (and contact details once friends)
	const act = async () => {
		if (!profile) return;
		setBusy(true);
		try {
			if (profile.friendship === 'received') await acceptFriendRequest(profile.id);
			else await addFriend(profile.id);
			await load();
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
			) : profile === null ? (
				<ActivityIndicator color={colors.accent} style={styles.loading} />
			) : (
				<ProfileView
					user={profile}
					seenAs={seenAsFor(profile.friendship)}
					action={
						profile.friendship !== 'self' && (
							<FriendAction relation={profile.friendship} busy={busy} onPress={act} />
						)
					}
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
