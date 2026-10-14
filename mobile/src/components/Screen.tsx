import { useContext, type ReactElement, type ReactNode } from 'react';
import {
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
	type RefreshControlProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, space, type } from '@/theme';
import { TabBarSpaceContext } from './FloatingTabBar';

type Props = {
	title?: string;
	right?: ReactNode;
	onClose?: () => void;
	scroll?: boolean;
	refreshControl?: ReactElement<RefreshControlProps>;
	children: ReactNode;
};

// Page frame: safe area, big title, scrolling body
export function Screen({ title, right, onClose, scroll = true, refreshControl, children }: Props) {
	// Extra room at the bottom when the floating tab bar is on screen
	const bottomSpace = { paddingBottom: space.huge + useContext(TabBarSpaceContext) };
	const header = (title || right || onClose) && (
		<View style={styles.header}>
			{title ? (
				<Text style={styles.title} accessibilityRole="header">
					{title}
				</Text>
			) : (
				<View />
			)}
			<View style={styles.right}>
				{right}
				{onClose && (
					<Pressable
						onPress={onClose}
						accessibilityRole="button"
						accessibilityLabel="Close"
						hitSlop={12}
						style={({ pressed }) => [styles.close, pressed && styles.pressed]}
					>
						<Ionicons name="close" size={22} color={colors.ink} />
					</Pressable>
				)}
			</View>
		</View>
	);

	return (
		<SafeAreaView edges={['top']} style={styles.safe}>
			<KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
				{scroll ? (
					<ScrollView
						testID="screen-scroll"
						contentContainerStyle={[styles.body, bottomSpace]}
						keyboardShouldPersistTaps="handled"
						refreshControl={refreshControl}
					>
						{header}
						{children}
					</ScrollView>
				) : (
					<View style={[styles.body, bottomSpace, styles.fill]}>
						{header}
						{children}
					</View>
				)}
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safe: {
		flex: 1,
		backgroundColor: colors.background,
	},
	fill: {
		flex: 1,
	},
	body: {
		paddingHorizontal: space.xl,
		paddingBottom: space.huge,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: space.md,
		paddingTop: space.lg,
		paddingBottom: space.xl,
	},
	title: {
		...type.largeTitle,
		color: colors.ink,
		flexShrink: 1,
	},
	right: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.md,
	},
	close: {
		width: 36,
		height: 36,
		borderRadius: 18,
		backgroundColor: colors.surface,
		alignItems: 'center',
		justifyContent: 'center',
	},
	pressed: {
		opacity: 0.6,
	},
});
