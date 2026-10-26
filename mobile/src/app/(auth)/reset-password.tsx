import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { requestPasswordReset, resetPassword } from '@/api/auth';
import { cleanCode, validateEmail, validateResetForm, type ResetForm, type ResetFormErrors } from '@/auth/authForms';
import { Button } from '@/components/Button';
import { PasswordField } from '@/components/PasswordField';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { ErrorText } from '@/feedback/ErrorText';
import { useFeedback } from '@/feedback/FeedbackProvider';
import { colors, space, type } from '@/theme';

// Second step of a password reset: the code from the email and the new password together
export default function ResetPasswordScreen() {
	const { toast } = useFeedback();
	const params = useLocalSearchParams<{ email?: string }>();
	// Without an email from the previous screen, the user types it here
	const [knownEmail] = useState(() => (typeof params.email === 'string' ? params.email : ''));
	const [form, setForm] = useState<ResetForm>({ email: knownEmail, code: '', newPassword: '' });
	const [errors, setErrors] = useState<ResetFormErrors>({});
	const [saving, setSaving] = useState(false);
	const [resending, setResending] = useState(false);
	const [error, setError] = useState<unknown>(null);

	const update = (changes: Partial<ResetForm>) => {
		setForm((current) => ({ ...current, ...changes }));
		setErrors({});
		setError(null);
	};

	// Sets the new password, then back to login: the backend gives no tokens here
	const submit = async () => {
		const result = validateResetForm(form);
		if (!result.ok) {
			setErrors(result.errors);
			return;
		}
		setSaving(true);
		setError(null);
		try {
			await resetPassword(result.input);
			toast('Password changed. Log in with your new password.', 'success');
			router.dismissTo({ pathname: '/login', params: { email: result.input.email } });
		} catch (err) {
			setError(err);
			setSaving(false);
		}
	};

	// New code by email, the old one stops working
	const resend = async () => {
		const result = validateEmail(form.email);
		if (!result.ok) {
			setErrors({ email: result.error });
			return;
		}
		setResending(true);
		setError(null);
		try {
			await requestPasswordReset(result.email);
			update({ code: '' });
			toast('New code sent', 'success');
		} catch (err) {
			setError(err);
		} finally {
			setResending(false);
		}
	};

	return (
		<Screen title="Choose a new password" back={{ label: 'Log in', onPress: () => router.back() }}>
			<Text style={styles.intro}>
				{knownEmail ? (
					<>
						If an account uses <Text style={styles.email}>{knownEmail}</Text>, we sent it a 6-digit code.
					</>
				) : (
					'Enter your email and the 6-digit code we sent to it.'
				)}{' '}
				It works for 1 hour.
			</Text>
			<View style={styles.form}>
				{!knownEmail && (
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
				)}
				<TextField
					label="Code"
					value={form.code}
					onChangeText={(code) => update({ code: cleanCode(code) })}
					error={errors.code}
					placeholder="123456"
					keyboardType="number-pad"
					maxLength={6}
					autoComplete="one-time-code"
					textContentType="oneTimeCode"
					returnKeyType="next"
				/>
				<PasswordField
					label="New password"
					value={form.newPassword}
					onChangeText={(newPassword) => update({ newPassword })}
					error={errors.newPassword}
					hint="At least 8 characters."
					autoComplete="new-password"
					textContentType="newPassword"
					returnKeyType="go"
					onSubmitEditing={submit}
				/>
				<View>
					<Button label="Change password" onPress={submit} loading={saving} disabled={resending} />
					<ErrorText error={error} />
				</View>
				<Button label="Send a new code" variant="quiet" onPress={resend} loading={resending} disabled={saving} />
			</View>
		</Screen>
	);
}

const styles = StyleSheet.create({
	intro: {
		...type.body,
		color: colors.muted,
	},
	email: {
		fontWeight: '600',
		color: colors.ink,
	},
	form: {
		gap: space.lg,
		marginTop: space.xl,
	},
});
