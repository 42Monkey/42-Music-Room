import { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
	Easing,
	useAnimatedReaction,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withTiming,
	type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, type } from '@/theme';
import type { Track } from '@/types/api';
import { movePlace, type Places } from './playlistOrder';

const ROW_H = 64;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

type Props = {
	tracks: Track[];
	// People who may edit can also move and remove tracks (backend rule)
	canEdit: boolean;
	onMove: (trackId: string, to: number) => void;
	onRemove: (track: Track) => void;
	onDragChange: (dragging: boolean) => void;
};

function placesOf(tracks: Track[]): Places {
	return Object.fromEntries(tracks.map((track, index) => [track.id, index]));
}

// Playlist rows: hold a handle and drag to move a track, the others slide aside
export function PlaylistEditor({ tracks, canEdit, onMove, onRemove, onDragChange }: Props) {
	const places = useSharedValue<Places>(placesOf(tracks));
	const dragging = useRef(false);

	// New order (ours or from the server): every row slides to its place, never mid-drag
	useEffect(() => {
		if (!dragging.current) places.value = placesOf(tracks);
	}, [tracks, places]);

	const changeDrag = useCallback(
		(on: boolean) => {
			dragging.current = on;
			onDragChange(on);
		},
		[onDragChange],
	);

	return (
		<View style={styles.card}>
			<View style={{ height: tracks.length * ROW_H }}>
				{tracks.map((track, index) => (
					<Row
						key={track.id}
						track={track}
						index={index}
						count={tracks.length}
						places={places}
						canEdit={canEdit}
						onMove={onMove}
						onRemove={onRemove}
						onDragChange={changeDrag}
					/>
				))}
			</View>
		</View>
	);
}

type RowProps = Omit<Props, 'tracks'> & {
	track: Track;
	index: number;
	count: number;
	places: SharedValue<Places>;
};

function Row({ track, index, count, places, canEdit, onMove, onRemove, onDragChange }: RowProps) {
	const reduceMotion = useReducedMotion();
	const id = track.id;
	const lastPlace = count - 1;
	const top = useSharedValue(index * ROW_H);
	const lifted = useSharedValue(0);
	const held = useSharedValue(false);
	const startTop = useSharedValue(0);
	const startPlace = useSharedValue(0);

	// Slides to its place when the order changes, except while held
	useAnimatedReaction(
		() => places.value[id],
		(place, previous) => {
			if (place === undefined || held.value) return;
			const y = place * ROW_H;
			top.value = previous == null || reduceMotion ? y : withTiming(y, { duration: 200, easing: EASE_OUT });
		},
	);

	// Short hold on the handle, then drag; the page stops scrolling meanwhile
	const drag = Gesture.Pan()
		.activateAfterLongPress(150)
		.onStart(() => {
			held.value = true;
			startTop.value = top.value;
			startPlace.value = places.value[id];
			lifted.value = withTiming(1, { duration: 150, easing: EASE_OUT });
			scheduleOnRN(onDragChange, true);
		})
		.onUpdate((event) => {
			top.value = Math.min(Math.max(startTop.value + event.translationY, 0), lastPlace * ROW_H);
			const place = Math.min(Math.max(Math.round(top.value / ROW_H), 0), lastPlace);
			if (place !== places.value[id]) places.value = movePlace(places.value, id, place);
		})
		.onFinalize(() => {
			if (!held.value) return;
			const place = places.value[id];
			held.value = false;
			top.value = withTiming(place * ROW_H, { duration: 160, easing: EASE_OUT });
			lifted.value = withTiming(0, { duration: 160, easing: EASE_OUT });
			scheduleOnRN(onDragChange, false);
			if (place !== startPlace.value) scheduleOnRN(onMove, id, place);
		});

	const look = useAnimatedStyle(() => ({
		zIndex: held.value ? 1 : 0,
		shadowOpacity: 0.14 * lifted.value,
		elevation: 6 * lifted.value,
		transform: [{ translateY: top.value }, { scale: 1 + 0.02 * lifted.value }],
	}));

	// Screen readers move one step at a time instead of dragging
	const step = (actionName: string) => {
		const to = actionName === 'moveUp' ? index - 1 : index + 1;
		if (to >= 0 && to <= lastPlace) onMove(id, to);
	};

	return (
		<Animated.View style={[styles.row, index < lastPlace && styles.rowLine, look]}>
			<Text style={styles.rank}>{index + 1}</Text>
			<View style={styles.rowText}>
				<Text style={styles.title} numberOfLines={1}>
					{track.title}
				</Text>
				<Text style={styles.artist} numberOfLines={1}>
					{track.artist}
				</Text>
			</View>
			{canEdit && (
				<Pressable
					onPress={() => onRemove(track)}
					hitSlop={8}
					accessibilityRole="button"
					accessibilityLabel={`Remove ${track.title}`}
					style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
				>
					<Ionicons name="trash-outline" size={20} color={colors.muted} />
				</Pressable>
			)}
			{canEdit && (
				<GestureDetector gesture={drag}>
					<Animated.View
						accessible
						accessibilityLabel={`Move ${track.title}`}
						accessibilityHint="Hold, then drag up or down"
						accessibilityActions={[
							{ name: 'moveUp', label: 'Move up' },
							{ name: 'moveDown', label: 'Move down' },
						]}
						onAccessibilityAction={(event) => step(event.nativeEvent.actionName)}
						hitSlop={8}
						style={styles.iconButton}
					>
						<Ionicons name="reorder-three" size={26} color={colors.muted} />
					</Animated.View>
				</GestureDetector>
			)}
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	card: {
		backgroundColor: colors.surface,
		borderRadius: radius.card,
		paddingHorizontal: 14,
	},
	row: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		height: ROW_H,
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.md,
		backgroundColor: colors.surface,
		shadowColor: colors.ink,
		shadowRadius: 12,
		shadowOffset: { width: 0, height: 4 },
	},
	rowLine: {
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: colors.line,
	},
	rank: {
		width: 20,
		...type.callout,
		fontWeight: '700',
		color: colors.muted,
		fontVariant: ['tabular-nums'],
	},
	rowText: {
		flex: 1,
	},
	title: {
		...type.headline,
		fontSize: 16,
		color: colors.ink,
	},
	artist: {
		...type.caption,
		fontWeight: '400',
		color: colors.muted,
	},
	iconButton: {
		width: 36,
		height: 36,
		alignItems: 'center',
		justifyContent: 'center',
	},
	pressed: {
		opacity: 0.5,
	},
});
