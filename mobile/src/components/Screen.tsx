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
	back?: { label: string; onPress: () => void };
	scroll?: boolean;
	refreshControl?: ReactElement<RefreshControlProps>;
	children: ReactNode;
};

// Page frame: safe area, big title, scrolling body
export function Screen({ title, right, onClose, back, scroll = true, refreshControl, children }: Props) {
	// Extra room at the bottom when the floating tab bar is on screen
	const bottomSpace = { paddingBottom: space.huge + useContext(TabBarSpaceContext) };

	const titleText = title ? (
		<Text style={[styles.title, back && styles.detailTitle]} accessibilityRole="header">
			{title}
		</Text>
	) : (
		<View />
	);

	// Detail screens: back link and badge on top, smaller title below
	const header = back ? (
		<View style={styles.detailHeader}>
			<View style={styles.backRow}>
				<Pressable
					onPress={back.onPress}
					accessibilityRole="button"
					accessibilityLabel={`Back to ${back.label}`}
					hitSlop={12}
					style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
				>
					<Ionicons name="chevron-back" size={22} color={colors.ink} />
					<Text style={styles.backText}>{back.label}</Text>
				</Pressable>
				{right}
			</View>
			{titleText}
		</View>
	) : (
		(title || right || onClose) && (
			<View style={styles.header}>
				{titleText}
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
		)
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
	detailHeader: {
		paddingTop: space.sm,
		paddingBottom: space.md,
		gap: space.sm,
	},
	backRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		minHeight: 44,
	},
	backButton: {
		flexDirection: 'row',
		alignItems: 'center',
		marginLeft: -6,
	},
	backText: {
		...type.body,
		fontWeight: '500',
		color: colors.ink,
	},
	title: {
		...type.largeTitle,
		color: colors.ink,
		flexShrink: 1,
	},
	detailTitle: {
		fontSize: 28,
		lineHeight: 34,
		letterSpacing: -0.5,
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
