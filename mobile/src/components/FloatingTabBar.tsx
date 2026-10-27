import { createContext } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { colors, radius, space, type } from '@/theme';

const BAR_HEIGHT = 64;

// Distance between the bar and the bottom edge of the phone
export function barBottom(safeBottom: number): number {
	return Math.max(safeBottom - 6, space.lg);
}

// Room screens leave at the bottom so nothing hides behind the bar
export function tabBarSpace(safeBottom: number): number {
	return barBottom(safeBottom) + BAR_HEIGHT + space.lg;
}

export const TabBarSpaceContext = createContext(0);

// Floating pill tab bar: active tab shows its icon, the others their name
export function FloatingTabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
	return (
		<View accessibilityRole="tablist" style={[styles.bar, { bottom: barBottom(insets.bottom) }]}>
			{state.routes.map((route, index) => {
				const options = descriptors[route.key].options;
				const label = typeof options.title === 'string' ? options.title : route.name;
				const focused = state.index === index;

				// Same tab: let the screen react, no navigation
				const open = () => {
					const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
					if (!focused && !event.defaultPrevented) navigateToTab(route.key);
				};

				return (
					<Pressable
						key={route.key}
						onPress={open}
						accessibilityRole="tab"
						accessibilityLabel={label}
						accessibilityState={{ selected: focused }}
						style={({ pressed }) => [styles.tab, focused && styles.active, pressed && styles.pressed]}
					>
						{focused && options.tabBarIcon?.({ focused, color: colors.accent, size: 18 })}
						<Text style={[styles.label, focused && styles.activeLabel]}>{label}</Text>
					</Pressable>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	bar: {
		position: 'absolute',
		left: space.xl,
		right: space.xl,
		height: BAR_HEIGHT,
		padding: 6,
		flexDirection: 'row',
		gap: space.xs,
		borderRadius: radius.pill,
		backgroundColor: colors.surface,
		borderWidth: 1,
		borderColor: colors.line,
		shadowColor: colors.ink,
		shadowOpacity: 0.12,
		shadowRadius: 20,
		shadowOffset: { width: 0, height: 10 },
		elevation: 10,
	},
	tab: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 6,
		borderRadius: radius.pill,
	},
	active: {
		backgroundColor: colors.accentSoft,
	},
	pressed: {
		transform: [{ scale: 0.97 }],
	},
	label: {
		...type.caption,
		fontWeight: '600',
		color: colors.muted,
	},
	activeLabel: {
		fontWeight: '700',
		color: colors.accentText,
	},
});
