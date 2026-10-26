import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { nextTrack } from '@/api/tracks';
import { Button } from '@/components/Button';
import { useFeedback } from '@/feedback/FeedbackProvider';
import { freshPreview } from '@/lib/deezer';
import { formatDuration } from '@/rooms/roomText';
import { colors, radius, space, type } from '@/theme';
import type { Track } from '@/types/api';
import type { NowPlayingState } from './useNowPlaying';

// Deezer previews last 30 seconds
const PREVIEW_S = 30;

const elapsed = (startedAt: number) => (Date.now() - startedAt) / 1000;

type Props = {
	roomId: string;
	now: NowPlayingState;
	tracks: Track[];
	isOwner: boolean;
	onPlaying: (track: Track | null, startedAt: string | null) => void;
};

// The room's current track, played on every phone from the same second
export function NowPlaying({ roomId, now, tracks, isOwner, onPlaying }: Props) {
	const { showError } = useFeedback();
	const player = useAudioPlayer();
	const status = useAudioPlayerStatus(player);
	const [listening, setListening] = useState(true);
	const listeningRef = useRef(listening);
	listeningRef.current = listening;
	const [cover, setCover] = useState<string | null>(null);
	const [broken, setBroken] = useState(false);
	const [moving, setMoving] = useState(false);
	const movingRef = useRef(false);
	const lastSeek = useRef(0);
	const [, setTick] = useState(0);
	const progress = useSharedValue(0);
	const track = now.track ?? tracks.find((entry) => entry.id === now.trackId) ?? null;
	const providerId = track?.providerId;
	const { startedAt } = now;

	// Plays even with the iPhone's silent switch on
	useEffect(() => {
		setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
	}, []);

	// New track: fresh preview link, then play (the room's second is caught up below)
	useEffect(() => {
		let cancelled = false;
		setCover(null);
		setBroken(false);
		if (!providerId || startedAt === null) {
			player.pause();
			return;
		}
		freshPreview(providerId)
			.then((preview) => {
				if (cancelled) return;
				setCover(preview.coverUrl);
				player.replace({ uri: preview.previewUrl });
				if (listeningRef.current && elapsed(startedAt) < PREVIEW_S) player.play();
			})
			.catch(() => {
				if (!cancelled) setBroken(true);
			});
		return () => {
			cancelled = true;
		};
	}, [providerId, startedAt, player]);

	// Keeps this phone on the room's second (first load, buffering, unmuting)
	useEffect(() => {
		if (startedAt === null || !status.isLoaded || !status.playing) return;
		const expected = elapsed(startedAt);
		if (expected >= PREVIEW_S) {
			player.pause();
			return;
		}
		if (Math.abs(status.currentTime - expected) > 1 && Date.now() - lastSeek.current > 2000) {
			lastSeek.current = Date.now();
			player.seekTo(expected).catch(() => {});
		}
	}, [status.currentTime, status.isLoaded, status.playing, startedAt, player]);

	// Progress bar runs from the room's second to the end; the time label ticks each second
	useEffect(() => {
		cancelAnimation(progress);
		if (startedAt === null) {
			progress.value = 0;
			return;
		}
		const done = Math.min(elapsed(startedAt) / PREVIEW_S, 1);
		progress.value = done;
		progress.value = withTiming(1, { duration: (1 - done) * PREVIEW_S * 1000, easing: Easing.linear });
		const ticker = setInterval(() => setTick((tick) => tick + 1), 1000);
		return () => clearInterval(ticker);
	}, [startedAt]);

	const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));

	// Owner only (backend rule): starts the next track for everyone
	const advance = useCallback(async () => {
		if (movingRef.current) return;
		movingRef.current = true;
		setMoving(true);
		try {
			const result = await nextTrack(roomId);
			onPlaying(result.currentTrack, result.startedAt);
		} catch (error) {
			showError(error, { as: 'toast' });
		} finally {
			movingRef.current = false;
			setMoving(false);
		}
	}, [roomId, onPlaying, showError]);

	// The owner's phone moves the room on when the preview ends
	useEffect(() => {
		if (!isOwner || startedAt === null) return;
		const timer = setTimeout(advance, Math.max(0, startedAt + PREVIEW_S * 1000 - Date.now()) + 500);
		return () => clearTimeout(timer);
	}, [isOwner, startedAt, advance]);

	// Mute or listen on this phone only
	const toggleListening = () => {
		if (listening) {
			player.pause();
			setListening(false);
			return;
		}
		setListening(true);
		if (startedAt !== null && elapsed(startedAt) < PREVIEW_S) player.play();
	};

	if (!now.trackId) {
		return (
			<View style={[styles.card, styles.idle]}>
				<Ionicons name="radio-outline" size={22} color={colors.muted} />
				{isOwner ? (
					<View style={styles.idleBody}>
						<Text style={styles.idleText}>
							{tracks.length > 0 ? 'Nothing playing yet.' : 'Nothing playing yet. Add a track, then start the music.'}
						</Text>
						{tracks.length > 0 && <Button label="Start playing" icon="play" onPress={advance} loading={moving} />}
					</View>
				) : (
					<Text style={[styles.idleText, styles.idleBody]}>Nothing playing yet. The owner starts the music.</Text>
				)}
			</View>
		);
	}

	if (!track) {
		return (
			<View style={[styles.card, styles.idle]}>
				<ActivityIndicator color={colors.accent} />
			</View>
		);
	}

	const seconds = startedAt === null ? 0 : Math.min(Math.max(Math.floor(elapsed(startedAt)), 0), PREVIEW_S);

	return (
		<View style={styles.card}>
			<View style={styles.top}>
				<View accessible accessibilityLabel={`Now playing: ${track.title} by ${track.artist}`} style={styles.info}>
					{cover ? (
						<Image source={{ uri: cover }} style={styles.cover} />
					) : (
						<View style={[styles.cover, styles.noCover]}>
							<Ionicons name="musical-notes" size={22} color={colors.muted} />
						</View>
					)}
					<View style={styles.text}>
						<Text style={styles.title} numberOfLines={1}>
							{track.title}
						</Text>
						<Text style={styles.artist} numberOfLines={1}>
							{track.artist}
						</Text>
					</View>
				</View>
				<Pressable
					onPress={toggleListening}
					accessibilityRole="button"
					accessibilityLabel={listening ? 'Mute' : 'Listen'}
					hitSlop={6}
					style={({ pressed }) => [styles.listen, !listening && styles.muted, pressed && styles.pressed]}
				>
					<Ionicons name={listening ? 'volume-high' : 'volume-mute'} size={22} color={listening ? '#FFFFFF' : colors.ink} />
				</Pressable>
			</View>

			<View style={styles.bar}>
				<Animated.View style={[styles.barFill, fill]} />
			</View>
			<View style={styles.times}>
				<Text style={styles.time}>{formatDuration(seconds * 1000) || '0:00'}</Text>
				<Text style={styles.time}>{formatDuration(PREVIEW_S * 1000)}</Text>
			</View>

			{broken && <Text style={styles.broken}>This track can't be played right now.</Text>}
			{isOwner && (
				<Button label="Next track" variant="secondary" icon="play-skip-forward" onPress={advance} loading={moving} />
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	card: {
		backgroundColor: colors.surface,
		borderRadius: radius.card,
		padding: space.lg,
		gap: space.md,
	},
	idle: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.md,
	},
	idleBody: {
		flex: 1,
		gap: space.md,
	},
	idleText: {
		...type.callout,
		color: colors.muted,
	},
	top: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.md,
	},
	info: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.md,
	},
	cover: {
		width: 56,
		height: 56,
		borderRadius: 10,
	},
	noCover: {
		backgroundColor: colors.background,
		alignItems: 'center',
		justifyContent: 'center',
	},
	text: {
		flex: 1,
	},
	title: {
		...type.headline,
		color: colors.ink,
	},
	artist: {
		...type.callout,
		color: colors.muted,
	},
	listen: {
		width: 44,
		height: 44,
		borderRadius: radius.pill,
		backgroundColor: colors.accent,
		alignItems: 'center',
		justifyContent: 'center',
	},
	muted: {
		backgroundColor: colors.background,
	},
	pressed: {
		opacity: 0.7,
	},
	bar: {
		height: 4,
		borderRadius: 2,
		backgroundColor: colors.line,
		overflow: 'hidden',
	},
	barFill: {
		height: 4,
		backgroundColor: colors.accent,
		transformOrigin: 'left',
	},
	times: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginTop: -space.xs,
	},
	time: {
		...type.caption,
		color: colors.muted,
		fontVariant: ['tabular-nums'],
	},
	broken: {
		...type.callout,
		color: colors.danger,
	},
});
