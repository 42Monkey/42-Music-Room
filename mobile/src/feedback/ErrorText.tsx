import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, space, type } from '@/theme';
import { describeError } from './describeError';

type Props = {
	error?: unknown;
	message?: string | null;
	style?: StyleProp<ViewStyle>;
};

// Inline error under the field or button that failed
export function ErrorText({ error, message, style }: Props) {
	const text = message ?? (error ? describeError(error).message : null);
	if (!text) return null;

	return (
		<View accessible accessibilityRole="alert" style={[styles.row, style]}>
			<Ionicons name="alert-circle" size={18} color={colors.danger} style={styles.icon} />
			<Text style={styles.text}>{text}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: space.sm,
		marginTop: space.sm,
	},
	icon: {
		marginTop: 2,
	},
	text: {
		...type.callout,
		color: colors.danger,
		flex: 1,
	},
});
