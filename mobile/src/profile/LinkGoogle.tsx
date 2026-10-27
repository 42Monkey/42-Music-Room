import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { linkGoogle } from '@/api/auth';
import { getGoogleIdToken } from '@/auth/google';
import { Button } from '@/components/Button';
import { ErrorText } from '@/feedback/ErrorText';
import { useFeedback } from '@/feedback/FeedbackProvider';
import { colors, space, type } from '@/theme';

// Backend answer when this Google account was linked before (200, not an error)
const ALREADY_LINKED = 'Google account already linked to this profile';

// Links a Google account to the logged-in user (V.1). The backend doesn't say yet whether
// one is linked, so the button is always there and its answer says what happened
export function LinkGoogle() {
	const { toast } = useFeedback();
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<unknown>(null);

	const link = async () => {
		setLoading(true);
		setError(null);
		try {
			const idToken = await getGoogleIdToken();
			if (idToken) {
				const { message } = await linkGoogle(idToken);
				toast(
					message === ALREADY_LINKED ? 'This Google account is already linked to you' : 'Google account linked',
					'success',
				);
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
			<Text style={styles.hint}>Link Google to log in with it next time.</Text>
			<Button label="Link Google account" variant="secondary" icon="logo-google" onPress={link} loading={loading} />
			<ErrorText error={error} />
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
});
