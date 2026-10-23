import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { resendVerification, verifyEmail } from '@/api/auth';
import { cleanCode, validateEmail, validateVerifyForm, type VerifyForm, type VerifyFormErrors } from '@/auth/authForms';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { ErrorText } from '@/feedback/ErrorText';
import { useFeedback } from '@/feedback/FeedbackProvider';
import { colors, space, type } from '@/theme';

// 6-digit code sent by email, opened after sign-up or a login refused for an unverified email
export default function VerifyEmailScreen() {
	const { toast } = useFeedback();
	const params = useLocalSearchParams<{ email?: string }>();
	// Without an email from the previous screen, the user types it here
	const [knownEmail] = useState(() => (typeof params.email === 'string' ? params.email : ''));
	const [form, setForm] = useState<VerifyForm>({ email: knownEmail, code: '' });
	const [errors, setErrors] = useState<VerifyFormErrors>({});
	const [verifying, setVerifying] = useState(false);
	const [resending, setResending] = useState(false);
	const [error, setError] = useState<unknown>(null);

	const update = (changes: Partial<VerifyForm>) => {
		setForm((current) => ({ ...current, ...changes }));
		setErrors({});
		setError(null);
	};

	// Checks the code, then back to login: the backend gives no tokens here
	const submit = async () => {
		const result = validateVerifyForm(form);
		if (!result.ok) {
			setErrors(result.errors);
			return;
		}
		setVerifying(true);
		setError(null);
		try {
			await verifyEmail(result.input.email, result.input.code);
			toast('Email verified. Log in to continue.', 'success');
			// Back to the open login screen, with the email filled in
			router.dismissTo({ pathname: '/login', params: { email: result.input.email } });
		} catch (err) {
			setError(err);
			setVerifying(false);
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
			await resendVerification(result.email);
			update({ code: '' });
			toast('New code sent', 'success');
		} catch (err) {
			setError(err);
		} finally {
			setResending(false);
		}
	};

	return (
		<Screen title="Check your email" back={{ label: 'Log in', onPress: () => router.back() }}>
			<Text style={styles.intro}>
				{knownEmail ? (
					<>
						We sent a 6-digit code to <Text style={styles.email}>{knownEmail}</Text>.
					</>
				) : (
					'Enter your email and the 6-digit code we sent to it.'
				)}{' '}
				It can take a minute, check your spam folder too.
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
					returnKeyType="go"
					onSubmitEditing={submit}
				/>
				<View>
					<Button label="Verify email" onPress={submit} loading={verifying} disabled={resending} />
					<ErrorText error={error} />
				</View>
				<Button label="Send a new code" variant="quiet" onPress={resend} loading={resending} disabled={verifying} />
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
