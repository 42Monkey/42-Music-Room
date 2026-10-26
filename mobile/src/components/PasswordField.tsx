import { useState, type Ref } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ErrorText } from '@/feedback/ErrorText';
import { colors, radius, space, type } from '@/theme';

type Props = Omit<TextInputProps, 'secureTextEntry'> & {
	label: string;
	error?: string | null;
	hint?: string;
	ref?: Ref<TextInput>;
};

// Password input with a show / hide button, same look as TextField
export function PasswordField({ label, error, hint, ref, onFocus, onBlur, ...input }: Props) {
	const [focused, setFocused] = useState(false);
	const [visible, setVisible] = useState(false);

	return (
		<View style={styles.field}>
			<Text style={styles.label}>{label}</Text>
			<View style={[styles.box, focused && styles.focused, error ? styles.invalid : null]}>
				<TextInput
					ref={ref}
					accessibilityLabel={label}
					placeholderTextColor={colors.muted}
					secureTextEntry={!visible}
					autoCapitalize="none"
					autoCorrect={false}
					onFocus={(event) => {
						setFocused(true);
						onFocus?.(event);
					}}
					onBlur={(event) => {
						setFocused(false);
						onBlur?.(event);
					}}
					style={styles.input}
					{...input}
				/>
				<Pressable
					onPress={() => setVisible((current) => !current)}
					accessibilityRole="button"
					accessibilityLabel={visible ? 'Hide password' : 'Show password'}
					hitSlop={8}
					style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
				>
					<Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.muted} />
				</Pressable>
			</View>
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
	box: {
		flexDirection: 'row',
		alignItems: 'center',
		minHeight: 52,
		borderRadius: radius.control,
		borderWidth: 1.5,
		borderColor: colors.line,
		backgroundColor: colors.surface,
	},
	focused: {
		borderColor: colors.ink,
	},
	invalid: {
		borderColor: colors.danger,
	},
	// No lineHeight: it pushes the text out of the box on iOS
	input: {
		flex: 1,
		alignSelf: 'stretch',
		fontSize: type.body.fontSize,
		paddingLeft: space.lg,
		color: colors.ink,
	},
	toggle: {
		paddingHorizontal: space.md,
		alignSelf: 'stretch',
		justifyContent: 'center',
	},
	pressed: {
		opacity: 0.6,
	},
	hint: {
		...type.caption,
		color: colors.muted,
	},
});
