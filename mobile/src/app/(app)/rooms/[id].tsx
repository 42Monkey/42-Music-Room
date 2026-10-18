import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, {
	Easing,
	FadeInDown,
	interpolateColor,
	LinearTransition,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { ApiError } from '@/api/errors';
import { getRoom } from '@/api/rooms';
import { removeTrack, reorderTrack, unvoteTrack, voteTrack } from '@/api/tracks';
import { Button } from '@/components/Button';
import { OnAirBadge } from '@/components/OnAirBadge';
import { Screen } from '@/components/Screen';
import { Tag } from '@/components/Tag';
import { ErrorState } from '@/feedback/ErrorState';
import { useFeedback } from '@/feedback/FeedbackProvider';
import { currentPosition } from '@/lib/location';
import { NowPlaying } from '@/player/NowPlaying';
import { useNowPlaying } from '@/player/useNowPlaying';
import { PlaylistEditor } from '@/rooms/PlaylistEditor';
import { canTakePart } from '@/rooms/roomAccess';
import { moveItem, placeAfter } from '@/rooms/playlistOrder';
import { kindLabel, ruleLabel } from '@/rooms/roomText';
import { useSession } from '@/session/SessionProvider';
import { useRoomTracks } from '@/socket/useRoomTracks';
import { useSocket } from '@/socket/SocketProvider';
import { colors, radius, space, type } from '@/theme';
import type { Room, Track } from '@/types/api';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Server answers meaning "it was already that way"
const ALREADY = ['You have already voted for this track', 'You have not voted for this track'];

function toggled(ids: Set<string>, id: string, on: boolean): Set<string> {
	const next = new Set(ids);
	if (on) next.add(id);
	else next.delete(id);
	return next;
}

// One room: its rules and its live track list
export default function RoomScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const roomId = String(id);
	const { user } = useSession();
	const { connected } = useSocket();
	const { toast, dialog, showError } = useFeedback();
	const [room, setRoom] = useState<Room | null>(null);
	const [roomError, setRoomError] = useState<unknown>(null);

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

	// Anyone who can see a room sees its list; place and time only count when acting (owner exempt)
	const needsPosition = !!room && room.accessPolicy === 'RESTRICTED' && room.ownerId !== user?.id;
	const { tracks, setTracks, myVotes, loading, error, reload } = useRoomTracks(roomId, { enabled: !!room });
	const { now, show } = useNowPlaying(room, loadRoom);
	// The playing track sits in the player card, the list shows what comes next
	const queue = tracks.filter((track) => track.id !== now.trackId);
	const [dragging, setDragging] = useState(false);
	const back = { label: 'Rooms', onPress: () => router.back() };

	// User's votes: from the server on each load, then changed at once on tap
	const [voted, setVoted] = useState<Set<string>>(() => new Set());
	const pending = useRef(new Set<string>());

	useEffect(() => {
		setVoted(myVotes);
	}, [myVotes]);

	// Vote or take it back; shown at once, the counts come from the server
	const toggleVote = async (track: Track) => {
		if (pending.current.has(track.id)) return;
		pending.current.add(track.id);
		const wasVoted = voted.has(track.id);
		setVoted((current) => toggled(current, track.id, !wasVoted));
		try {
			// Place-and-time rooms: where the phone is now, not when the room opened
			const where = needsPosition ? await currentPosition() : null;
			if (wasVoted) await unvoteTrack(roomId, track.id, where);
			else await voteTrack(roomId, track.id, where);
			if (!connected) reload();
		} catch (err) {
			if (!(err instanceof ApiError && ALREADY.includes(String(err.serverMessage)))) {
				setVoted((current) => toggled(current, track.id, wasVoted));
				showError(err);
			}
		} finally {
			pending.current.delete(track.id);
		}
	};

	// Search sheet; place-and-time rooms check the phone's position when adding
	const openSearch = (kind: Room['kind']) => {
		const params: Record<string, string> = { roomId, kind };
		if (needsPosition) params.needsPosition = '1';
		router.push({ pathname: '/rooms/add-track', params });
	};

	// Playlist move: shown at once, then the server sends the final order to everyone
	const move = async (trackId: string, to: number) => {
		const from = queue.findIndex((track) => track.id === trackId);
		if (from < 0 || from === to) return;
		const shown = moveItem(queue, from, to);
		const afterTrackId = to === 0 ? null : shown[to - 1].id;
		setTracks(placeAfter(tracks, trackId, afterTrackId));
		try {
			await reorderTrack(roomId, trackId, afterTrackId);
			if (!connected) reload();
		} catch (err) {
			showError(err);
			reload();
		}
	};

	// Owner only (backend rule), after a confirmation since it can't be undone
	const confirmRemove = (track: Track) =>
		dialog({
			title: `Remove ${track.title}?`,
			message: 'It will be removed from the playlist for everyone.',
			primary: { label: 'Remove', onPress: () => remove(track) },
			secondary: { label: 'Cancel' },
		});

	const remove = async (track: Track) => {
		try {
			await removeTrack(roomId, track.id);
			toast('Track removed', 'success');
			if (!connected) reload();
		} catch (err) {
			showError(err);
		}
	};

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
	const canAct = canTakePart(room, user?.id);

	return (
		<Screen back={back} title={room.name} right={<OnAirBadge on={connected} />} scrollEnabled={!dragging}>
			<View style={styles.tags}>
				<Tag label={kindLabel(room)} tone="accent" />
				<Tag label={ruleLabel(room)} />
				{room.visibility === 'PRIVATE' && <Tag label="Private" icon="lock-closed" />}
			</View>
			{room.description ? <Text style={styles.description}>{room.description}</Text> : null}
			{!canAct && (
				<View style={styles.notice}>
					<Ionicons name="eye-outline" size={18} color={colors.muted} />
					<Text style={styles.noticeText}>
						{isVote ? 'Only invited people can vote here.' : 'Only invited people can edit this playlist.'}
					</Text>
				</View>
			)}
			{canAct && (
				<Button
					label={isVote ? 'Suggest a track' : 'Add a track'}
					icon="add"
					onPress={() => openSearch(room.kind)}
					style={styles.addButton}
				/>
			)}
			{room.ownerId === user?.id && (room.visibility === 'PRIVATE' || room.accessPolicy === 'INVITE_ONLY') && (
				<Button
					label="Invite people"
					variant="secondary"
					icon="person-add"
					onPress={() => router.push({ pathname: '/rooms/invite', params: { roomId } })}
					style={styles.inviteButton}
				/>
			)}

			<View style={styles.sectionHeader}>
				<Text style={styles.sectionTitle} accessibilityRole="header">
					Now playing
				</Text>
			</View>
			<NowPlaying roomId={roomId} now={now} tracks={tracks} isOwner={room.ownerId === user?.id} onPlaying={show} />

			<View style={styles.sectionHeader}>
				<Text style={styles.sectionTitle} accessibilityRole="header">
					{isVote ? 'Up next' : 'Tracks'}
				</Text>
				{isVote && <Text style={styles.sectionHint}>Most votes play first</Text>}
			</View>

			{error ? (
				<ErrorState error={error} onRetry={reload} />
			) : loading ? (
				<ActivityIndicator color={colors.accent} style={styles.loading} />
			) : queue.length === 0 ? (
				<View style={styles.empty}>
					<Text style={styles.emptyTitle}>{now.trackId ? 'Nothing up next' : 'No tracks yet'}</Text>
					<Text style={styles.emptyText}>
						{isVote ? 'Suggest the first one. The most voted track plays first.' : 'Add the first track to this playlist.'}
					</Text>
				</View>
			) : isVote ? (
				<View style={styles.list}>
					{queue.map((track, index) => (
						<TrackRow
							key={track.id}
							track={track}
							index={index}
							voted={voted.has(track.id)}
							canVote={canAct}
							onVote={() => toggleVote(track)}
							last={index === queue.length - 1}
						/>
					))}
				</View>
			) : (
				<PlaylistEditor
					tracks={queue}
					canEdit={canAct}
					onMove={move}
					onRemove={confirmRemove}
					onDragChange={setDragging}
				/>
			)}
		</Screen>
	);
}

type RowProps = { track: Track; index: number; voted: boolean; canVote: boolean; onVote: () => void; last: boolean };

// One voted track: fades in on load, glides when the order changes
function TrackRow({ track, index, voted, canVote, onVote, last }: RowProps) {
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
			{canVote ? (
				<VoteButton title={track.title} score={track.score} voted={voted} onPress={onVote} />
			) : (
				<View accessible accessibilityLabel={`${track.score} ${track.score === 1 ? 'vote' : 'votes'}`} style={styles.votes}>
					<Ionicons name="arrow-up" size={14} color={colors.muted} />
					<Text style={[styles.voteCount, styles.voteCountMuted]}>{track.score}</Text>
				</View>
			)}
		</Animated.View>
	);
}

type VoteProps = { title: string; score: number; voted: boolean; onPress: () => void };

// Vote toggle: outlined until you vote, raspberry once you have
function VoteButton({ title, score, voted, onPress }: VoteProps) {
	const reduceMotion = useReducedMotion();
	const press = useSharedValue(1);
	const on = useSharedValue(voted ? 1 : 0);

	useEffect(() => {
		on.value = reduceMotion ? (voted ? 1 : 0) : withTiming(voted ? 1 : 0, { duration: 160, easing: EASE_OUT });
	}, [voted, reduceMotion, on]);

	const look = useAnimatedStyle(() => ({
		transform: [{ scale: press.value }],
		backgroundColor: interpolateColor(on.value, [0, 1], [colors.surface, colors.accent]),
		borderColor: interpolateColor(on.value, [0, 1], [colors.line, colors.accent]),
	}));
	const color = voted ? '#FFFFFF' : colors.ink;

	return (
		<AnimatedPressable
			onPress={onPress}
			onPressIn={() => {
				press.value = withTiming(0.94, { duration: 100, easing: EASE_OUT });
			}}
			onPressOut={() => {
				press.value = withTiming(1, { duration: 160, easing: EASE_OUT });
			}}
			hitSlop={8}
			accessibilityRole="button"
			accessibilityLabel={`Vote for ${title}`}
			accessibilityValue={{ text: `${score} ${score === 1 ? 'vote' : 'votes'}` }}
			accessibilityState={{ selected: voted }}
			style={[styles.votes, look]}
		>
			<Ionicons name="arrow-up" size={14} color={color} />
			<Text style={[styles.voteCount, { color }]}>{score}</Text>
		</AnimatedPressable>
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
	addButton: {
		marginTop: space.lg,
	},
	notice: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.sm,
		marginTop: space.lg,
	},
	noticeText: {
		...type.callout,
		color: colors.muted,
		flex: 1,
	},
	inviteButton: {
		marginTop: space.sm,
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
	voteCountMuted: {
		color: colors.muted,
	},
	voteCount: {
		...type.callout,
		fontWeight: '700',
		color: colors.ink,
		fontVariant: ['tabular-nums'],
	},
});
