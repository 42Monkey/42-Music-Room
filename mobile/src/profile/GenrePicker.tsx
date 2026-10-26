import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, type } from '@/theme';
import { genreLabel } from './genres';

type Props = {
	label: string;
	// Fixed while the form is open, so an unpicked genre stays in place
	choices: string[];
	value: string[];
	onChange: (value: string[]) => void;
};

// Genres as tags, tap to pick or unpick
export function GenrePicker({ label, choices, value, onChange }: Props) {
	const toggle = (genre: string) =>
		onChange(value.includes(genre) ? value.filter((picked) => picked !== genre) : [...value, genre]);

	return (
		<View style={styles.field}>
			<Text style={styles.label}>{label}</Text>
			<View style={styles.chips}>
				{choices.map((genre) => {
					const picked = value.includes(genre);
					return (
						<Pressable
							key={genre}
							onPress={() => toggle(genre)}
							accessibilityRole="checkbox"
							accessibilityLabel={genreLabel(genre)}
							accessibilityState={{ checked: picked }}
							hitSlop={4}
							style={({ pressed }) => [styles.chip, picked && styles.picked, pressed && styles.pressed]}
						>
							{picked && <Ionicons name="checkmark" size={14} color={colors.accentText} />}
							<Text style={[styles.chipText, picked && styles.pickedText]}>{genreLabel(genre)}</Text>
						</Pressable>
					);
				})}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	field: {
		gap: space.sm,
	},
	label: {
		...type.caption,
		color: colors.muted,
	},
	chips: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: space.sm,
	},
	chip: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.xs,
		minHeight: 36,
		paddingHorizontal: space.md,
		borderRadius: radius.pill,
		borderWidth: 1.5,
		borderColor: colors.line,
		backgroundColor: colors.surface,
	},
	picked: {
		borderColor: colors.accentSoft,
		backgroundColor: colors.accentSoft,
	},
	pressed: {
		opacity: 0.6,
	},
	chipText: {
		...type.callout,
		fontWeight: '500',
		color: colors.ink,
	},
	pickedText: {
		fontWeight: '600',
		color: colors.accentText,
	},
});
