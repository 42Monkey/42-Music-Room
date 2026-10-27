import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { login } from '@/api/auth';
import { ApiError } from '@/api/errors';
import { validateLoginForm, type LoginForm, type LoginFormErrors } from '@/auth/authForms';
import { GoogleButton } from '@/auth/GoogleButton';
import { Button } from '@/components/Button';
import { PasswordField } from '@/components/PasswordField';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { ErrorText } from '@/feedback/ErrorText';
import { useSession } from '@/session/SessionProvider';
import { colors, space, type } from '@/theme';

// Email + password login, first screen when logged out
export default function LoginScreen() {
	const { signIn } = useSession();
	const [form, setForm] = useState<LoginForm>({ email: '', password: '' });
	const [errors, setErrors] = useState<LoginFormErrors>({});
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<unknown>(null);
	const passwordRef = useRef<TextInput>(null);
	const { email: verifiedEmail } = useLocalSearchParams<{ email?: string }>();

	// Back from email verification: email filled in, cursor on the password
	useEffect(() => {
		if (typeof verifiedEmail !== 'string' || !verifiedEmail) return;
		setForm((current) => ({ ...current, email: verifiedEmail }));
		passwordRef.current?.focus();
	}, [verifiedEmail]);

	const update = (changes: Partial<LoginForm>) => {
		setForm((current) => ({ ...current, ...changes }));
		setErrors({});
		setError(null);
	};

	// Checks the fields, logs in, the app then switches to the tabs by itself
	const submit = async () => {
		const result = validateLoginForm(form);
		if (!result.ok) {
			setErrors(result.errors);
			return;
		}
		const { email, password } = result.input;
		setLoading(true);
		setError(null);
		try {
			await signIn(await login(email, password));
		} catch (err) {
			setLoading(false);
			// Only reason login answers 403: the email isn't verified yet
			if (err instanceof ApiError && err.status === 403) {
				router.push({ pathname: '/verify-email', params: { email } });
				return;
			}
			setError(err);
		}
	};

	return (
		<Screen title="Music Room">
			<Text style={styles.intro}>Log in to vote, edit playlists and share the music.</Text>
			<View style={styles.form}>
				<TextField
					label="Email"
					value={form.email}
					onChangeText={(email) => update({ email })}
					error={errors.email}
					placeholder="you@example.com"
					keyboardType="email-address"
					autoCapitalize="none"
					autoCorrect={false}
					autoComplete="email"
					textContentType="emailAddress"
					returnKeyType="next"
				/>
				<PasswordField
					ref={passwordRef}
					label="Password"
					value={form.password}
					onChangeText={(password) => update({ password })}
					error={errors.password}
					autoComplete="current-password"
					textContentType="password"
					returnKeyType="go"
					onSubmitEditing={submit}
				/>
				<View>
					<Button label="Log in" onPress={submit} loading={loading} />
					<ErrorText error={error} />
				</View>
				<Button
					label="Forgot password?"
					variant="quiet"
					onPress={() => router.push({ pathname: '/forgot-password', params: { email: form.email.trim() } })}
				/>
				<GoogleButton />
			</View>

			<View style={styles.footer}>
				<Button label="Create an account" variant="secondary" onPress={() => router.push('/register')} />
				<Button label="Server settings" variant="quiet" icon="settings-outline" onPress={() => router.push('/settings')} />
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
	footer: {
		gap: space.md,
		marginTop: space.xxl,
	},
});
