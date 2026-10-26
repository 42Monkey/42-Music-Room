import { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { useFeedback } from '@/feedback/FeedbackProvider';
import { LinkGoogle } from '@/profile/LinkGoogle';
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
			right={
				<Pressable
					onPress={() => router.push('/profile/edit')}
					accessibilityRole="button"
					accessibilityLabel="Edit profile"
					hitSlop={12}
					style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
				>
					<Ionicons name="pencil" size={18} color={colors.ink} />
				</Pressable>
			}
			refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
		>
			{/* Always there while logged in, the tabs only show after login */}
			{user && <ProfileView user={user} seenAs="self" />}
			<LinkGoogle />
		</Screen>
	);
}

const styles = StyleSheet.create({
	iconButton: {
		width: 36,
		height: 36,
		borderRadius: 18,
		backgroundColor: colors.surface,
		alignItems: 'center',
		justifyContent: 'center',
	},
	pressed: {
		opacity: 0.6,
	},
});
