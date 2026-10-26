import { Image, StyleSheet, Text, View, type ImageStyle, type StyleProp } from 'react-native';
import { colors } from '@/theme';

type Props = {
	name: string;
	url: string | null;
	size?: number;
	// Margins only, shared by the photo and the letter
	style?: StyleProp<ImageStyle>;
};

// Round photo, or the first letter of the name when there is none
export function Avatar({ name, url, size = 40, style }: Props) {
	const shape = { width: size, height: size, borderRadius: size / 2 };

	if (url) return <Image source={{ uri: url }} style={[styles.photo, shape, style]} accessibilityIgnoresInvertColors />;
	return (
		<View style={[styles.initial, shape, style]}>
			<Text style={[styles.letter, { fontSize: Math.round(size * 0.42) }]}>{name.trim().charAt(0).toUpperCase() || '?'}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	photo: {
		backgroundColor: colors.surface,
	},
	initial: {
		backgroundColor: colors.accentSoft,
		alignItems: 'center',
		justifyContent: 'center',
	},
	letter: {
		fontWeight: '600',
		color: colors.accentText,
	},
});
