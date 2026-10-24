import { useState } from 'react';
import { RefreshControl } from 'react-native';
import { Screen } from '@/components/Screen';
import { useFeedback } from '@/feedback/FeedbackProvider';
import { ProfileView } from '@/profile/ProfileView';
import { useSession } from '@/session/SessionProvider';
import { colors } from '@/theme';

// Profile tab: my profile as loaded at login, pull down for a fresh copy
export default function ProfileScreen() {
	const { user, refreshUser } = useSession();
	const { showError } = useFeedback();
	const [refreshing, setRefreshing] = useState(false);

	// A failed refresh keeps the profile on screen and says why in a toast
	const refresh = async () => {
		setRefreshing(true);
		try {
			await refreshUser();
		} catch (error) {
			showError(error, { as: 'toast' });
		} finally {
			setRefreshing(false);
		}
	};

	return (
		<Screen
			title="Profile"
			refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
		>
			{/* Always there while logged in, the tabs only show after login */}
			{user && <ProfileView user={user} seenAs="self" />}
		</Screen>
	);
}
