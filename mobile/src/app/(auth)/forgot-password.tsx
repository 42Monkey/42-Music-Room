import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { requestPasswordReset } from '@/api/auth';
import { validateEmail } from '@/auth/authForms';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { ErrorText } from '@/feedback/ErrorText';
import { colors, space, type } from '@/theme';

// First step of a password reset: the email that gets the code
export default function ForgotPasswordScreen() {
	const params = useLocalSearchParams<{ email?: string }>();
	// Whatever was typed on the login screen
	const [email, setEmail] = useState(() => (typeof params.email === 'string' ? params.email : ''));
	const [emailError, setEmailError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<unknown>(null);

	const changeEmail = (text: string) => {
		setEmail(text);
		setEmailError(null);
		setError(null);
	};

	// Asks for a code, then the screen to type it with the new password
	const submit = async () => {
		const result = validateEmail(email);
		if (!result.ok) {
			setEmailError(result.error);
			return;
		}
		setLoading(true);
		setError(null);
		try {
			await requestPasswordReset(result.email);
			// Replaced: going back from the next screen lands on login
			router.replace({ pathname: '/reset-password', params: { email: result.email } });
		} catch (err) {
			setError(err);
			setLoading(false);
		}
	};

	return (
		<Screen title="Reset your password" back={{ label: 'Log in', onPress: () => router.back() }}>
			<Text style={styles.intro}>Enter your account's email. We'll send you a 6-digit code to choose a new password.</Text>
			<View style={styles.form}>
				<TextField
					label="Email"
					value={email}
					onChangeText={changeEmail}
					error={emailError}
					placeholder="you@example.com"
					keyboardType="email-address"
					autoCapitalize="none"
					autoCorrect={false}
					autoComplete="email"
					textContentType="emailAddress"
					returnKeyType="go"
					onSubmitEditing={submit}
				/>
				<View>
					<Button label="Send code" onPress={submit} loading={loading} />
					<ErrorText error={error} />
				</View>
			</View>
		</Screen>
	);
}

const styles = StyleSheet.create({
	intro: {
		...type.body,
		color: colors.muted,
	},
	form: {
		gap: space.lg,
		marginTop: space.xl,
	},
});
