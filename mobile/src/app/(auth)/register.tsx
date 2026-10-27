import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { register } from '@/api/auth';
import { validateRegisterForm, type RegisterForm, type RegisterFormErrors } from '@/auth/authForms';
import { GoogleButton } from '@/auth/GoogleButton';
import { Button } from '@/components/Button';
import { PasswordField } from '@/components/PasswordField';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { ErrorText } from '@/feedback/ErrorText';
import { useFeedback } from '@/feedback/FeedbackProvider';
import { colors, space, type } from '@/theme';

// Sign-up with email + password, opened from the login screen
export default function RegisterScreen() {
	const { toast } = useFeedback();
	const [form, setForm] = useState<RegisterForm>({ displayName: '', email: '', password: '' });
	const [errors, setErrors] = useState<RegisterFormErrors>({});
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<unknown>(null);

	const update = (changes: Partial<RegisterForm>) => {
		setForm((current) => ({ ...current, ...changes }));
		setErrors({});
		setError(null);
	};

	// Checks the fields, creates the account, then asks for the code sent by email
	const submit = async () => {
		const result = validateRegisterForm(form);
		if (!result.ok) {
			setErrors(result.errors);
			return;
		}
		setLoading(true);
		setError(null);
		try {
			await register(result.input);
			toast('Account created', 'success');
			// Replaced: going back from the code screen lands on login, not on a filled form
			router.replace({ pathname: '/verify-email', params: { email: result.input.email } });
		} catch (err) {
			setError(err);
			setLoading(false);
		}
	};

	return (
		<Screen title="Create an account" back={{ label: 'Log in', onPress: () => router.back() }}>
			<Text style={styles.intro}>We'll send a 6-digit code to your email to check it's yours.</Text>
			<View style={styles.form}>
				<TextField
					label="Name"
					value={form.displayName}
					onChangeText={(displayName) => update({ displayName })}
					error={errors.displayName}
					hint="Shown to other people in rooms."
					placeholder="Mia K"
					maxLength={50}
					autoComplete="name"
					textContentType="name"
					returnKeyType="next"
				/>
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
					label="Password"
					value={form.password}
					onChangeText={(password) => update({ password })}
					error={errors.password}
					hint="At least 8 characters."
					autoComplete="new-password"
					textContentType="newPassword"
					returnKeyType="go"
					onSubmitEditing={submit}
				/>
				<View>
					<Button label="Create account" onPress={submit} loading={loading} />
					<ErrorText error={error} />
				</View>
				<GoogleButton />
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
