import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, space, type } from '@/theme';

// Radio studio sign: lit while live updates are connected
export function OnAirBadge({ on }: { on: boolean }) {
	return (
		<View
			accessible
			accessibilityLabel={on ? 'Live updates connected' : 'Live updates disconnected'}
			style={[styles.badge, on ? styles.on : styles.off]}
		>
			<View style={[styles.dot, on ? styles.dotOn : styles.dotOff]} />
			<Text style={[styles.text, { color: on ? '#FFFFFF' : colors.muted }]}>{on ? 'On air' : 'Off air'}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	badge: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.xs + 2,
		paddingVertical: space.xs + 1,
		paddingHorizontal: space.md,
		borderRadius: radius.pill,
	},
	on: {
		backgroundColor: colors.accent,
		shadowColor: colors.accent,
		shadowOpacity: 0.45,
		shadowRadius: 10,
		shadowOffset: { width: 0, height: 2 },
	},
	off: {
		borderWidth: 1,
		borderColor: colors.line,
	},
	dot: {
		width: 7,
		height: 7,
		borderRadius: 4,
	},
	dotOn: {
		backgroundColor: '#FFFFFF',
	},
	dotOff: {
		borderWidth: 1.5,
		borderColor: colors.muted,
	},
	text: {
		...type.caption,
		fontWeight: '700',
	},
});
