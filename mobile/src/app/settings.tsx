import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/api/client';
import { ApiError, NetworkError } from '@/api/errors';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { ErrorText } from '@/feedback/ErrorText';
import { describeError } from '@/feedback/describeError';
import { useFeedback } from '@/feedback/FeedbackProvider';
import { useSession } from '@/session/SessionProvider';
import { normalizeServerUrl } from '@/settings/serverUrl';
import { useSettings } from '@/settings/SettingsProvider';
import { colors, radius, space, type } from '@/theme';

type Check = { state: 'idle' } | { state: 'checking' } | { state: 'ok'; url: string } | { state: 'failed'; message: string };

// What went wrong when testing a freshly saved address
function failureMessage(error: unknown, url: string): string {
	if (error instanceof NetworkError && error.reason === 'timeout') {
		return `Saved, but ${url} took too long to answer. Check that the backend is running.`;
	}
	if (error instanceof NetworkError) {
		return `Saved, but nothing answered at ${url}. Check the address and that the backend is running.`;
	}
	if (error instanceof ApiError && error.status === 404) {
		return `Saved, but ${url} doesn't look like the Music Room backend.`;
	}
	return `Saved, but the test failed: ${describeError(error).message}`;
}

// Backend address (V.5) and logout
export default function SettingsScreen() {
	const { ready, serverUrl, defaultUrl, isCustom, saveServerUrl, resetServerUrl } = useSettings();
	const { status, user, signOut } = useSession();
	const { toast } = useFeedback();
	const [input, setInput] = useState(serverUrl);
	const [inputError, setInputError] = useState<string | null>(null);
	const [check, setCheck] = useState<Check>({ state: 'idle' });

	// Field follows the saved address (first load, reset)
	useEffect(() => {
		if (ready) setInput(serverUrl);
	}, [ready, serverUrl]);

	// Saves the address, then checks the backend answers
	const save = async () => {
		const result = normalizeServerUrl(input);
		if (!result.ok) {
			setInputError(result.error);
			return;
		}
		setInputError(null);
		setInput(result.url);
		setCheck({ state: 'checking' });
		await saveServerUrl(result.url);
		try {
			await api.get('/health');
			setCheck({ state: 'ok', url: result.url });
			toast('Server address saved', 'success');
		} catch (error) {
			setCheck({ state: 'failed', message: failureMessage(error, result.url) });
		}
	};

	const useDefault = async () => {
		await resetServerUrl();
		setCheck({ state: 'idle' });
		toast('Back to the default address', 'info');
	};

	const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

	return (
		<Screen title="Server" onClose={close}>
			<Text style={styles.intro}>
				The app talks to the Music Room backend at this address. After running make, use the https link printed in the
				terminal.
			</Text>

			<View style={styles.section}>
				<TextField
					label="Backend address"
					value={input}
					onChangeText={(text) => {
						setInput(text);
						setInputError(null);
					}}
					error={inputError}
					hint={isCustom && defaultUrl ? `Default: ${defaultUrl}` : 'Using the default address.'}
					placeholder="http://192.168.1.10:8080"
					autoCapitalize="none"
					autoCorrect={false}
					keyboardType="url"
					returnKeyType="done"
					onSubmitEditing={save}
				/>

				{check.state === 'ok' && (
					<View style={styles.success} accessible accessibilityRole="alert">
						<Ionicons name="checkmark-circle" size={18} color={colors.live} />
						<Text style={styles.successText}>Connected to {check.url}</Text>
					</View>
				)}
				{check.state === 'failed' && <ErrorText message={check.message} />}

				<Button label="Save and test" onPress={save} loading={check.state === 'checking'} />
				{isCustom && defaultUrl ? <Button label="Use default address" variant="quiet" onPress={useDefault} /> : null}
			</View>

			{status === 'signedIn' && user && (
				<View style={[styles.section, styles.account]}>
					<Text style={styles.accountText}>Logged in as {user.displayName}</Text>
					<Button label="Log out" variant="danger" icon="log-out-outline" onPress={signOut} />
				</View>
			)}
		</Screen>
	);
}

const styles = StyleSheet.create({
	intro: {
		...type.body,
		color: colors.muted,
		marginBottom: space.xl,
	},
	section: {
		gap: space.lg,
	},
	success: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.sm,
		backgroundColor: colors.liveSoft,
		borderRadius: radius.control,
		padding: space.md,
	},
	successText: {
		...type.callout,
		color: colors.live,
		flex: 1,
	},
	account: {
		marginTop: space.huge,
		paddingTop: space.xl,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: colors.line,
	},
	accountText: {
		...type.callout,
		color: colors.muted,
	},
});
