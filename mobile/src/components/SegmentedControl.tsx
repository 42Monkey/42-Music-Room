import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, radius, space, type } from '@/theme';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
	label: string;
	options: Option<T>[];
	value: T;
	onChange: (value: T) => void;
};

const INSET = 3;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

// Option picker: the white pill slides to the chosen option
export function SegmentedControl<T extends string>({ label, options, value, onChange }: Props<T>) {
	const [width, setWidth] = useState(0);
	const reduceMotion = useReducedMotion();
	const index = Math.max(0, options.findIndex((option) => option.value === value));
	const segment = width > 0 ? (width - INSET * 2) / options.length : 0;
	const x = useSharedValue(0);

	// Slide on change, jump on first layout or with reduced motion
	useEffect(() => {
		const target = index * segment;
		x.value = reduceMotion ? target : withTiming(target, { duration: 220, easing: EASE_OUT });
	}, [index, segment, reduceMotion, x]);

	const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

	return (
		<View style={styles.field}>
			<Text style={styles.label}>{label}</Text>
			<View
				accessibilityRole="radiogroup"
				accessibilityLabel={label}
				onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
				style={styles.track}
			>
				{segment > 0 && <Animated.View style={[styles.indicator, { width: segment }, indicator]} />}
				{options.map((option) => {
					const selected = option.value === value;
					return (
						<Pressable
							key={option.value}
							onPress={() => onChange(option.value)}
							accessibilityRole="radio"
							accessibilityLabel={option.label}
							accessibilityState={{ checked: selected }}
							style={({ pressed }) => [styles.option, pressed && !selected && styles.pressed]}
						>
							<Text numberOfLines={1} style={[styles.optionText, selected && styles.selectedText]}>
								{option.label}
							</Text>
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
	track: {
		flexDirection: 'row',
		padding: INSET,
		borderRadius: radius.control,
		backgroundColor: '#E6E7EE',
	},
	indicator: {
		position: 'absolute',
		top: INSET,
		bottom: INSET,
		left: INSET,
		borderRadius: radius.control - INSET,
		backgroundColor: colors.surface,
		shadowColor: colors.ink,
		shadowOpacity: 0.1,
		shadowRadius: 6,
		shadowOffset: { width: 0, height: 2 },
		elevation: 2,
	},
	option: {
		flex: 1,
		minHeight: 40,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: space.sm,
	},
	pressed: {
		opacity: 0.6,
	},
	optionText: {
		...type.caption,
		fontSize: 14,
		fontWeight: '600',
		color: colors.muted,
	},
	selectedText: {
		color: colors.ink,
	},
});
