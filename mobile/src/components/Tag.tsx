import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, type } from '@/theme';

type Props = {
	label: string;
	tone?: 'accent' | 'neutral';
	icon?: keyof typeof Ionicons.glyphMap;
};

// Small rounded label: room type, rules, private
export function Tag({ label, tone = 'neutral', icon }: Props) {
	const color = tone === 'accent' ? colors.accentText : colors.muted;
	return (
		<View style={[styles.tag, tone === 'accent' ? styles.accent : styles.neutral]}>
			{icon && <Ionicons name={icon} size={12} color={color} />}
			<Text style={[styles.text, { color }]}>{label}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	tag: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.xs,
		paddingVertical: 3,
		paddingHorizontal: 10,
		borderRadius: radius.pill,
	},
	accent: {
		backgroundColor: colors.accentSoft,
	},
	neutral: {
		backgroundColor: colors.surface,
	},
	text: {
		...type.caption,
		fontWeight: '600',
	},
});
