import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getUser } from '@/api/users';
import { Screen } from '@/components/Screen';
import { ErrorState } from '@/feedback/ErrorState';
import { ProfileView, type SeenAs } from '@/profile/ProfileView';
import { useSession } from '@/session/SessionProvider';
import { colors, space } from '@/theme';
import type { Profile } from '@/types/api';

// TODO: use the backend's friendship field once GET /users/:id has it (asked Tony).
// Until then: contact details only come back for friends.
function seenAsFor(profile: Profile, myId: string | undefined): SeenAs {
	if (profile.id === myId) return 'self';
	return 'location' in profile ? 'friend' : 'other';
}

// Someone's profile, opened from the friends list or the search; loaded fresh each time
export default function PersonScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const { user } = useSession();
	const [profile, setProfile] = useState<Profile | null>(null);
	const [error, setError] = useState<unknown>(null);

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

	return (
		<Screen back={{ label: 'Back', onPress: () => router.back() }}>
			{error ? (
				<ErrorState error={error} onRetry={load} />
			) : profile === null ? (
				<ActivityIndicator color={colors.accent} style={styles.loading} />
			) : (
				<ProfileView user={profile} seenAs={seenAsFor(profile, user?.id)} />
			)}
		</Screen>
	);
}

const styles = StyleSheet.create({
	loading: {
		marginTop: space.huge,
	},
});
