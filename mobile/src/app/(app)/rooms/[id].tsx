import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { getRoom } from '@/api/rooms';
import { OnAirBadge } from '@/components/OnAirBadge';
import { Screen } from '@/components/Screen';
import { Tag } from '@/components/Tag';
import { ErrorState } from '@/feedback/ErrorState';
import { currentPosition } from '@/lib/location';
import { kindLabel, ruleLabel } from '@/rooms/roomText';
import { useSession } from '@/session/SessionProvider';
import { useRoomTracks } from '@/socket/useRoomTracks';
import { useSocket } from '@/socket/SocketProvider';
import { colors, radius, space, type } from '@/theme';
import type { Position, Room, Track } from '@/types/api';

// One room: its rules and its live track list
export default function RoomScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const roomId = String(id);
	const { user } = useSession();
	const { connected } = useSocket();
	const [room, setRoom] = useState<Room | null>(null);
	const [roomError, setRoomError] = useState<unknown>(null);
	const [position, setPosition] = useState<Position | null>(null);
	const [positionError, setPositionError] = useState<unknown>(null);

	const loadRoom = useCallback(async () => {
		setRoomError(null);
		try {
			setRoom(await getRoom(roomId));
		} catch (error) {
			setRoomError(error);
		}
	}, [roomId]);

	useEffect(() => {
		loadRoom();
	}, [loadRoom]);

	// Place-and-time rooms check where the phone is (the owner is exempt)
	const needsPosition = !!room && room.accessPolicy === 'RESTRICTED' && room.ownerId !== user?.id;

	const locate = useCallback(async () => {
		setPositionError(null);
		try {
			setPosition(await currentPosition());
		} catch (error) {
			setPositionError(error);
		}
	}, []);

	useEffect(() => {
		if (needsPosition) locate();
	}, [needsPosition, locate]);

	const ready = !!room && (!needsPosition || !!position);
	const { tracks, loading, error, reload } = useRoomTracks(roomId, { position, enabled: ready });
	const back = { label: 'Rooms', onPress: () => router.back() };

	if (roomError) {
		return (
			<Screen back={back}>
				<ErrorState error={roomError} onRetry={loadRoom} />
			</Screen>
		);
	}

	if (!room) {
		return (
			<Screen back={back}>
				<ActivityIndicator color={colors.accent} style={styles.loading} />
			</Screen>
		);
	}

	const isVote = room.kind === 'VOTE';

	return (
		<Screen back={back} title={room.name} right={<OnAirBadge on={connected} />}>
			<View style={styles.tags}>
				<Tag label={kindLabel(room)} tone="accent" />
				<Tag label={ruleLabel(room)} />
				{room.visibility === 'PRIVATE' && <Tag label="Private" icon="lock-closed" />}
			</View>
			{room.description ? <Text style={styles.description}>{room.description}</Text> : null}

			<View style={styles.sectionHeader}>
				<Text style={styles.sectionTitle} accessibilityRole="header">
					{isVote ? 'Up next' : 'Tracks'}
				</Text>
				{isVote && <Text style={styles.sectionHint}>Most votes play first</Text>}
			</View>

			{positionError ? (
				<ErrorState error={positionError} onRetry={locate} />
			) : error ? (
				<ErrorState error={error} onRetry={reload} />
			) : loading ? (
				<ActivityIndicator color={colors.accent} style={styles.loading} />
			) : tracks.length === 0 ? (
				<View style={styles.empty}>
					<Text style={styles.emptyTitle}>No tracks yet</Text>
					<Text style={styles.emptyText}>
						{isVote ? 'Suggested tracks will show up here, sorted by votes.' : 'Tracks added to this playlist will show up here.'}
					</Text>
				</View>
			) : (
				<View style={styles.list}>
					{tracks.map((track, index) => (
						<TrackRow key={track.id} track={track} index={index} isVote={isVote} last={index === tracks.length - 1} />
					))}
				</View>
			)}
		</Screen>
	);
}

type RowProps = { track: Track; index: number; isVote: boolean; last: boolean };

// One track: fades in on load, glides when the order changes
function TrackRow({ track, index, isVote, last }: RowProps) {
	return (
		<Animated.View
			entering={FadeInDown.duration(250).delay(Math.min(index, 8) * 40)}
			layout={LinearTransition.duration(250)}
			style={[styles.row, !last && styles.rowLine]}
		>
			<Text style={styles.rank}>{index + 1}</Text>
			<View style={styles.rowText}>
				<Text style={styles.trackTitle} numberOfLines={1}>
					{track.title}
				</Text>
				<Text style={styles.trackArtist} numberOfLines={1}>
					{track.artist}
				</Text>
			</View>
			{isVote && (
				<View accessible accessibilityLabel={`${track.score} ${track.score === 1 ? 'vote' : 'votes'}`} style={styles.votes}>
					<Ionicons name="arrow-up" size={14} color={colors.ink} />
					<Text style={styles.voteCount}>{track.score}</Text>
				</View>
			)}
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	loading: {
		marginTop: space.huge,
	},
	tags: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: space.sm,
	},
	description: {
		...type.body,
		color: colors.muted,
		marginTop: space.md,
	},
	sectionHeader: {
		flexDirection: 'row',
		alignItems: 'baseline',
		justifyContent: 'space-between',
		marginTop: space.xl,
		marginBottom: space.md,
	},
	sectionTitle: {
		...type.title,
		fontSize: 20,
		color: colors.ink,
	},
	sectionHint: {
		...type.caption,
		color: colors.muted,
	},
	empty: {
		paddingVertical: space.xxl,
		gap: space.sm,
	},
	emptyTitle: {
		...type.headline,
		color: colors.ink,
	},
	emptyText: {
		...type.callout,
		color: colors.muted,
	},
	list: {
		backgroundColor: colors.surface,
		borderRadius: radius.card,
		paddingHorizontal: 14,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.md,
		minHeight: 58,
		backgroundColor: colors.surface,
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
	trackTitle: {
		...type.headline,
		fontSize: 16,
		color: colors.ink,
	},
	trackArtist: {
		...type.caption,
		fontWeight: '400',
		color: colors.muted,
	},
	votes: {
		minWidth: 56,
		height: 32,
		paddingHorizontal: space.md,
		borderRadius: radius.pill,
		borderWidth: 1.5,
		borderColor: colors.line,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: space.xs,
	},
	voteCount: {
		...type.callout,
		fontWeight: '700',
		color: colors.ink,
		fontVariant: ['tabular-nums'],
	},
});
