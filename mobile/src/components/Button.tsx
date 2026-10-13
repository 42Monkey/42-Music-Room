import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, type } from '@/theme';

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger';

type Props = {
	label: string;
	onPress: () => void;
	variant?: Variant;
	icon?: keyof typeof Ionicons.glyphMap;
	loading?: boolean;
	disabled?: boolean;
	style?: StyleProp<ViewStyle>;
};

const TEXT_COLOR: Record<Variant, string> = {
	primary: '#FFFFFF',
	secondary: colors.ink,
	quiet: colors.accent,
	danger: colors.danger,
};

// Main action button, blocked while its action runs
export function Button({ label, onPress, variant = 'primary', icon, loading = false, disabled = false, style }: Props) {
	const blocked = loading || disabled;
	const color = TEXT_COLOR[variant];

	return (
		<Pressable
			onPress={onPress}
			disabled={blocked}
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ disabled: blocked, busy: loading }}
			style={({ pressed }) => [
				styles.base,
				styles[variant],
				pressed && pressedStyles[variant],
				disabled && styles.disabled,
				style,
			]}
		>
			{loading ? (
				<ActivityIndicator color={color} />
			) : (
				<View style={styles.content}>
					{icon && <Ionicons name={icon} size={20} color={color} />}
					<Text style={[styles.label, { color }]}>{label}</Text>
				</View>
			)}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	base: {
		minHeight: 52,
		borderRadius: radius.control,
		paddingHorizontal: space.xl,
		alignItems: 'center',
		justifyContent: 'center',
	},
	primary: {
		backgroundColor: colors.accent,
	},
	secondary: {
		backgroundColor: colors.surface,
		borderWidth: 1,
		borderColor: colors.line,
	},
	quiet: {
		minHeight: 44,
		backgroundColor: 'transparent',
	},
	danger: {
		minHeight: 44,
		backgroundColor: 'transparent',
	},
	disabled: {
		opacity: 0.45,
	},
	content: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.sm,
	},
	label: {
		...type.headline,
	},
});

const pressedStyles = StyleSheet.create({
	primary: { backgroundColor: colors.accentPressed, transform: [{ scale: 0.98 }] },
	secondary: { backgroundColor: colors.background },
	quiet: { opacity: 0.6 },
	danger: { opacity: 0.6 },
});
