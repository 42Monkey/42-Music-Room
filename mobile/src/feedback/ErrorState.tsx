import { Linking, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/Button';
import { colors, radius, space, type } from '@/theme';
import { describeError } from './describeError';

type Props = {
	error: unknown;
	onRetry?: () => void;
};

// Replaces a screen's content when it could not load
export function ErrorState({ error, onRetry }: Props) {
	const { title, message, action } = describeError(error);

	return (
		<View style={styles.box} accessibilityRole="alert">
			<Text style={styles.title}>{title}</Text>
			<Text style={styles.message}>{message}</Text>
			<View style={styles.actions}>
				{action === 'settings' && (
					<Button label="Open settings" icon="settings-outline" onPress={() => router.push('/settings')} />
				)}
				{action === 'phone-settings' && (
					<Button label="Open phone settings" icon="settings-outline" onPress={() => Linking.openSettings()} />
				)}
				{onRetry && action !== 'login' && (
					<Button
						label="Try again"
						variant={action === 'settings' || action === 'phone-settings' ? 'secondary' : 'primary'}
						onPress={onRetry}
					/>
				)}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	box: {
		backgroundColor: colors.surface,
		borderRadius: radius.card,
		padding: space.xl,
		gap: space.sm,
	},
	title: {
		...type.title,
		color: colors.ink,
	},
	message: {
		...type.body,
		color: colors.muted,
	},
	actions: {
		gap: space.sm,
		marginTop: space.md,
	},
});
