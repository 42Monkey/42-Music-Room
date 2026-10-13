import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { ErrorText } from '@/feedback/ErrorText';
import { colors, radius, space, type } from '@/theme';

type Props = TextInputProps & {
	label: string;
	error?: string | null;
	hint?: string;
};

// Labelled input with its error or hint underneath
export function TextField({ label, error, hint, style, onFocus, onBlur, ...input }: Props) {
	const [focused, setFocused] = useState(false);

	return (
		<View style={styles.field}>
			<Text style={styles.label}>{label}</Text>
			<TextInput
				accessibilityLabel={label}
				placeholderTextColor={colors.muted}
				onFocus={(event) => {
					setFocused(true);
					onFocus?.(event);
				}}
				onBlur={(event) => {
					setFocused(false);
					onBlur?.(event);
				}}
				style={[styles.input, focused && styles.focused, error ? styles.invalid : null, style]}
				{...input}
			/>
			{error ? <ErrorText message={error} /> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
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
	// No lineHeight: it pushes the text out of the box on iOS
	input: {
		fontSize: type.body.fontSize,
		minHeight: 52,
		paddingHorizontal: space.lg,
		borderRadius: radius.control,
		borderWidth: 1.5,
		borderColor: colors.line,
		backgroundColor: colors.surface,
		color: colors.ink,
	},
	focused: {
		borderColor: colors.ink,
	},
	invalid: {
		borderColor: colors.danger,
	},
	hint: {
		...type.caption,
		color: colors.muted,
	},
});
