import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { api } from '@/api/client';
import { ApiError } from '@/api/errors';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ErrorText } from '@/feedback/ErrorText';
import { useSession } from '@/session/SessionProvider';
import { colors, space, type } from '@/theme';
import type { Tokens } from '@/types/api';

// TEMPORARY: replaced by Oleg's login screen, must not reach the evaluation
// Seeded test account, read from mobile/.env (never written in the code)
const TEST_ACCOUNT = {
	email: process.env.EXPO_PUBLIC_TEST_EMAIL ?? '',
	password: process.env.EXPO_PUBLIC_TEST_PASSWORD ?? '',
};

export default function LoginScreen() {
	const { signIn } = useSession();
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<unknown>(null);

	// Logs in as the seeded test user
	const testLogin = async () => {
		if (!TEST_ACCOUNT.email || !TEST_ACCOUNT.password) {
			setError(
				new Error(
					'add EXPO_PUBLIC_TEST_EMAIL and EXPO_PUBLIC_TEST_PASSWORD to mobile/.env (see mobile/.env.example), then restart make',
				),
			);
			return;
		}
		setLoading(true);
		setError(null);
		try {
			await signIn(await api.post<Tokens>('/auth/login', TEST_ACCOUNT));
		} catch (err) {
			setError(err);
			setLoading(false);
		}
	};

	const missingAccount = error instanceof ApiError && error.status === 401;

	return (
		<Screen title="Music Room">
			<Text style={styles.text}>The login screen is on its way. Until then, use the test account.</Text>
			<View style={styles.actions}>
				<Button label="Log in with the test account" onPress={testLogin} loading={loading} />
				{missingAccount ? (
					<ErrorText message="The test account doesn't exist yet. Run make (it seeds the database), then try again." />
				) : (
					<ErrorText error={error} />
				)}
				<Button label="Server settings" variant="quiet" icon="settings-outline" onPress={() => router.push('/settings')} />
			</View>
		</Screen>
	);
}

const styles = StyleSheet.create({
	text: {
		...type.body,
		color: colors.muted,
	},
	actions: {
		gap: space.md,
		marginTop: space.xl,
	},
});
