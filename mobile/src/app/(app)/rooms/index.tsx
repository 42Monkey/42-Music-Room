import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { listRooms } from '@/api/rooms';
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

	useEffect(() => {
		load();
	}, [load]);

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
						<RoomRow key={room.id} room={room} last={index === rooms.length - 1} />
					))}
				</View>
			)}
		</Screen>
	);
}

// One room: kind icon, name, private lock
function RoomRow({ room, last }: { room: Room; last: boolean }) {
	const kind = KIND[room.kind];

	return (
		<View style={[styles.row, !last && styles.rowLine]}>
			<View style={styles.kindIcon}>
				<Ionicons name={kind.icon} size={18} color={colors.accent} />
			</View>
			<View style={styles.rowText}>
				<Text style={styles.name} numberOfLines={1}>
					{room.name}
				</Text>
				<Text style={styles.kind}>{kind.label}</Text>
			</View>
			{room.visibility === 'PRIVATE' && (
				<Ionicons name="lock-closed" size={16} color={colors.muted} accessibilityLabel="Private room" />
			)}
		</View>
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
});
