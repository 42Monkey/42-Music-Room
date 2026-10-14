import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { listRooms } from '@/api/rooms';
import { Button } from '@/components/Button';
import { OnAirBadge } from '@/components/OnAirBadge';
import { Screen } from '@/components/Screen';
import { ErrorState } from '@/feedback/ErrorState';
import { useSocket } from '@/socket/SocketProvider';
import { colors, radius, space, type } from '@/theme';
import type { Room } from '@/types/api';

const KIND = {
	VOTE: { label: 'Track vote', icon: 'thumbs-up' },
	PLAYLIST: { label: 'Playlist', icon: 'list' },
} as const;

// Rooms visible to the user, pull down to refresh
export default function RoomsScreen() {
	const { connected } = useSocket();
	const [rooms, setRooms] = useState<Room[] | null>(null);
	const [error, setError] = useState<unknown>(null);
	const [refreshing, setRefreshing] = useState(false);

	const load = useCallback(async () => {
		try {
			setRooms(await listRooms());
			setError(null);
		} catch (err) {
			setError(err);
		}
	}, []);

	// Reload each time the list comes back on screen (after creating a room)
	useFocusEffect(
		useCallback(() => {
			load();
		}, [load]),
	);

	const refresh = async () => {
		setRefreshing(true);
		await load();
		setRefreshing(false);
	};

	const retry = () => {
		setError(null);
		setRooms(null);
		load();
	};

	return (
		<Screen
			title="Rooms"
			right={
				<>
					<OnAirBadge on={connected} />
					<Pressable
						onPress={() => router.push('/settings')}
						accessibilityRole="button"
						accessibilityLabel="Server settings"
						hitSlop={12}
						style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
					>
						<Ionicons name="settings-outline" size={20} color={colors.ink} />
					</Pressable>
				</>
			}
			refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
		>
			{error ? (
				<ErrorState error={error} onRetry={retry} />
			) : rooms === null ? (
				<ActivityIndicator color={colors.accent} style={styles.loading} />
			) : rooms.length === 0 ? (
				<View style={styles.empty}>
					<Text style={styles.emptyTitle}>No rooms yet</Text>
					<Text style={styles.emptyText}>Rooms you create or get invited to show up here.</Text>
				</View>
			) : (
				<View style={styles.list}>
					{rooms.map((room, index) => (
						<RoomRow key={room.id} room={room} index={index} last={index === rooms.length - 1} />
					))}
				</View>
			)}
			{!error && rooms !== null && (
				<Button label="Create a room" icon="add" onPress={() => router.push('/rooms/new')} style={styles.create} />
			)}
		</Screen>
	);
}

// One room: kind icon, name, private lock; fades in on first load
function RoomRow({ room, index, last }: { room: Room; index: number; last: boolean }) {
	const kind = KIND[room.kind];
	const isPrivate = room.visibility === 'PRIVATE';

	return (
		<Animated.View entering={FadeInDown.duration(250).delay(Math.min(index, 8) * 40)}>
			<Pressable
				onPress={() => router.push(`/rooms/${room.id}`)}
				accessibilityRole="button"
				accessibilityLabel={`Open ${room.name}${isPrivate ? ', private' : ''}`}
				style={({ pressed }) => [styles.row, !last && styles.rowLine, pressed && styles.rowPressed]}
			>
				<View style={styles.kindIcon}>
					<Ionicons name={kind.icon} size={18} color={colors.accent} />
				</View>
				<View style={styles.rowText}>
					<Text style={styles.name} numberOfLines={1}>
						{room.name}
					</Text>
					<Text style={styles.kind}>{kind.label}</Text>
				</View>
				{isPrivate && <Ionicons name="lock-closed" size={16} color={colors.muted} accessibilityLabel="Private room" />}
				<Ionicons name="chevron-forward" size={16} color={colors.line} />
			</Pressable>
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	iconButton: {
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
	loading: {
		marginTop: space.huge,
	},
	empty: {
		paddingVertical: space.huge,
		gap: space.sm,
	},
	emptyTitle: {
		...type.title,
		color: colors.ink,
	},
	emptyText: {
		...type.body,
		color: colors.muted,
	},
	list: {
		backgroundColor: colors.surface,
		borderRadius: radius.card,
		paddingHorizontal: space.lg,
		overflow: 'hidden',
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.md,
		paddingVertical: space.lg,
	},
	rowLine: {
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: colors.line,
	},
	rowPressed: {
		opacity: 0.55,
	},
	kindIcon: {
		width: 36,
		height: 36,
		borderRadius: 18,
		backgroundColor: colors.accentSoft,
		alignItems: 'center',
		justifyContent: 'center',
	},
	rowText: {
		flex: 1,
		gap: 2,
	},
	name: {
		...type.headline,
		color: colors.ink,
	},
	kind: {
		...type.caption,
		color: colors.muted,
	},
	create: {
		marginTop: space.xl,
	},
});
