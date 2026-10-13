import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, type } from '@/theme';

export type ToastKind = 'success' | 'error' | 'info';

export type ToastData = {
	id: number;
	message: string;
	kind: ToastKind;
};

const ICONS = {
	success: { name: 'checkmark-circle', color: '#4FD1A0' },
	error: { name: 'alert-circle', color: '#FF7A8A' },
	info: { name: 'radio', color: '#C9C7E0' },
} as const;

type Props = {
	toast: ToastData;
	onHide: () => void;
};

// Slides in from the top, tap to dismiss
export function Toast({ toast, onHide }: Props) {
	const insets = useSafeAreaInsets();
	const progress = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		AccessibilityInfo.announceForAccessibility(toast.message);
		AccessibilityInfo.isReduceMotionEnabled()
			.then((reduced) => {
				if (reduced) progress.setValue(1);
				else Animated.spring(progress, { toValue: 1, useNativeDriver: true, bounciness: 4 }).start();
			})
			.catch(() => progress.setValue(1));
	}, [toast.id, toast.message, progress]);

	const icon = ICONS[toast.kind];
	const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] });

	return (
		<Animated.View
			pointerEvents="box-none"
			style={[styles.wrap, { top: insets.top + space.sm, opacity: progress, transform: [{ translateY }] }]}
		>
			<Pressable onPress={onHide} accessibilityRole="button" accessibilityHint="Dismisses the message" style={styles.toast}>
				<Ionicons name={icon.name} size={20} color={icon.color} />
				<View style={styles.textWrap}>
					<Text style={styles.text}>{toast.message}</Text>
				</View>
			</Pressable>
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	wrap: {
		position: 'absolute',
		left: space.lg,
		right: space.lg,
		zIndex: 100,
	},
	toast: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.md,
		backgroundColor: colors.ink,
		borderRadius: radius.control,
		paddingVertical: space.md,
		paddingHorizontal: space.lg,
		shadowColor: colors.ink,
		shadowOpacity: 0.25,
		shadowRadius: 16,
		shadowOffset: { width: 0, height: 8 },
		elevation: 8,
	},
	textWrap: {
		flex: 1,
	},
	text: {
		...type.callout,
		color: '#FFFFFF',
	},
});
