import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { linkGoogle } from '@/api/auth';
import { getGoogleIdToken } from '@/auth/google';
import { Button } from '@/components/Button';
import { ErrorText } from '@/feedback/ErrorText';
import { useFeedback } from '@/feedback/FeedbackProvider';
import { useSession } from '@/session/SessionProvider';
import { colors, space, type } from '@/theme';

// Links a Google account to the logged-in user (V.1). Once linked, says so instead of the button
export function LinkGoogle() {
	const { user, refreshUser } = useSession();
	const { toast } = useFeedback();
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<unknown>(null);

	// Reloads the profile after linking, so googleLinked turns true and the button goes
	const link = async () => {
		setLoading(true);
		setError(null);
		try {
			const idToken = await getGoogleIdToken();
			if (idToken) {
				await linkGoogle(idToken);
				toast('Google account linked', 'success');
				await refreshUser();
			}
		} catch (err) {
			setError(err);
		} finally {
			setLoading(false);
		}
	};

	return (
		<View>
			<Text style={styles.title} accessibilityRole="header">
				Google account
			</Text>
			{user?.googleLinked ? (
				<View style={styles.linked}>
					<Ionicons name="checkmark-circle" size={20} color={colors.live} />
					<Text style={styles.linkedText}>Linked, you can log in with Google</Text>
				</View>
			) : (
				<>
					<Text style={styles.hint}>Link Google to log in with it next time.</Text>
					<Button label="Link Google account" variant="secondary" icon="logo-google" onPress={link} loading={loading} />
					<ErrorText error={error} />
				</>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	title: {
		...type.title,
		fontSize: 20,
		color: colors.ink,
		marginTop: space.xl,
		marginBottom: space.sm,
	},
	hint: {
		...type.callout,
		color: colors.muted,
		marginBottom: space.md,
	},
	linked: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.sm,
	},
	linkedText: {
		...type.callout,
		color: colors.ink,
	},
});
