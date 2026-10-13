import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space, type } from '@/theme';

export type DialogButton = {
	label: string;
	onPress?: () => void;
};

export type DialogOptions = {
	title: string;
	message: string;
	primary: DialogButton;
	secondary?: DialogButton;
};

type Props = {
	dialog: DialogOptions | null;
	onClose: () => void;
};

// Centered message that blocks until the user answers
export function Dialog({ dialog, onClose }: Props) {
	const press = (button?: DialogButton) => {
		onClose();
		button?.onPress?.();
	};

	return (
		<Modal visible={dialog !== null} transparent animationType="fade" onRequestClose={() => press(dialog?.secondary)}>
			<View style={styles.overlay}>
				{dialog && (
					<View style={styles.card} accessibilityViewIsModal>
						<Text style={styles.title} accessibilityRole="header">
							{dialog.title}
						</Text>
						<Text style={styles.message}>{dialog.message}</Text>
						<View style={styles.buttons}>
							{dialog.secondary && (
								<Pressable
									onPress={() => press(dialog.secondary)}
									accessibilityRole="button"
									style={({ pressed }) => [styles.button, styles.secondary, pressed && styles.pressed]}
								>
									<Text style={styles.secondaryText}>{dialog.secondary.label}</Text>
								</Pressable>
							)}
							<Pressable
								onPress={() => press(dialog.primary)}
								accessibilityRole="button"
								style={({ pressed }) => [styles.button, styles.primary, pressed && styles.primaryPressed]}
							>
								<Text style={styles.primaryText}>{dialog.primary.label}</Text>
							</Pressable>
						</View>
					</View>
				)}
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		backgroundColor: colors.overlay,
		justifyContent: 'center',
		padding: space.xl,
	},
	card: {
		backgroundColor: colors.surface,
		borderRadius: radius.card,
		padding: space.xl,
	},
	title: {
		...type.title,
		color: colors.ink,
	},
	message: {
		...type.body,
		color: colors.muted,
		marginTop: space.sm,
	},
	buttons: {
		flexDirection: 'row',
		justifyContent: 'flex-end',
		gap: space.sm,
		marginTop: space.xl,
	},
	button: {
		minHeight: 44,
		paddingHorizontal: space.lg,
		borderRadius: radius.pill,
		alignItems: 'center',
		justifyContent: 'center',
	},
	primary: {
		backgroundColor: colors.accent,
	},
	primaryPressed: {
		backgroundColor: colors.accentPressed,
	},
	secondary: {
		backgroundColor: colors.background,
	},
	pressed: {
		opacity: 0.7,
	},
	primaryText: {
		...type.headline,
		color: '#FFFFFF',
	},
	secondaryText: {
		...type.headline,
		color: colors.ink,
	},
});
