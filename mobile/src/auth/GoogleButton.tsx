import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { googleLogin } from '@/api/auth';
import { getGoogleIdToken } from '@/auth/google';
import { Button } from '@/components/Button';
import { ErrorText } from '@/feedback/ErrorText';
import { useSession } from '@/session/SessionProvider';
import { colors, space, type } from '@/theme';

// "or" line and Google button, same on login and sign-up: the backend creates the account
// on the first Google login. Closing the browser does nothing
export function GoogleButton() {
	const { signIn } = useSession();
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<unknown>(null);

	const continueWithGoogle = async () => {
		setLoading(true);
		setError(null);
		try {
			const idToken = await getGoogleIdToken();
			if (!idToken) {
				setLoading(false);
				return;
			}
			await signIn(await googleLogin(idToken));
		} catch (err) {
			setError(err);
			setLoading(false);
		}
	};

	return (
		<View style={styles.wrap}>
			<View style={styles.divider}>
				<View style={styles.line} />
				<Text style={styles.or}>or</Text>
				<View style={styles.line} />
			</View>
			<View>
				<Button
					label="Continue with Google"
					variant="secondary"
					icon="logo-google"
					onPress={continueWithGoogle}
					loading={loading}
				/>
				<ErrorText error={error} />
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: {
		gap: space.lg,
	},
	divider: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.md,
	},
	line: {
		flex: 1,
		height: StyleSheet.hairlineWidth,
		backgroundColor: colors.line,
	},
	or: {
		...type.caption,
		color: colors.muted,
	},
});
