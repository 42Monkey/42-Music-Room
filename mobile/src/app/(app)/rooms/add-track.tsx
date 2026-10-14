import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { addTrack, searchTracks } from '@/api/tracks';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { ErrorState } from '@/feedback/ErrorState';
import { useFeedback } from '@/feedback/FeedbackProvider';
import { formatDuration } from '@/rooms/roomText';
import { colors, radius, space, type } from '@/theme';
import type { TrackResult } from '@/types/api';

const MIN_LETTERS = 2;
const PAUSE_MS = 350;

type Params = { roomId: string; kind?: string; lat?: string; lng?: string };

// Deezer search, opened as a sheet from a room: tap a result to add it
export default function AddTrackScreen() {
	const params = useLocalSearchParams<Params>();
	const roomId = String(params.roomId);
	const isVote = params.kind !== 'PLAYLIST';
	const verb = isVote ? 'Suggest' : 'Add';
	const { lat, lng } = params;
	const { toast, showError } = useFeedback();
	const [text, setText] = useState('');
	const [results, setResults] = useState<TrackResult[]>([]);
	const [searched, setSearched] = useState('');
	const [searching, setSearching] = useState(false);
	const [error, setError] = useState<unknown>(null);
	const [adding, setAdding] = useState<string | null>(null);
	const latest = useRef(0);

	const search = useCallback(
		async (words: string) => {
			const id = ++latest.current;
			setSearching(true);
			setError(null);
			try {
				const position = lat && lng ? { lat: Number(lat), lng: Number(lng) } : null;
				const found = await searchTracks(roomId, words, position);
				// An older search answering late is ignored
				if (id !== latest.current) return;
				setResults(found);
				setSearched(words);
			} catch (err) {
				if (id === latest.current) setError(err);
			} finally {
				if (id === latest.current) setSearching(false);
			}
		},
		[roomId, lat, lng],
	);

	// Searches once typing pauses
	const words = text.trim();
	useEffect(() => {
		if (words.length < MIN_LETTERS) {
			latest.current += 1;
			setResults([]);
			setSearched('');
			setSearching(false);
			setError(null);
			return;
		}
		const timer = setTimeout(() => search(words), PAUSE_MS);
		return () => clearTimeout(timer);
	}, [words, search]);

	// Adds the track, then back to the room where it shows up live
	const add = async (result: TrackResult) => {
		if (adding) return;
		setAdding(result.providerId);
		try {
			const position = lat && lng ? { lat: Number(lat), lng: Number(lng) } : null;
			await addTrack(roomId, result.providerId, position);
			toast(isVote ? 'Track suggested' : 'Track added', 'success');
			router.back();
		} catch (err) {
			showError(err);
			setAdding(null);
		}
	};

	let body = null;
	if (error) {
		body = <ErrorState error={error} onRetry={() => search(words)} />;
	} else if (words.length < MIN_LETTERS) {
		body = <Text style={styles.hint}>Type a title or an artist.</Text>;
	} else if (results.length === 0 && searching) {
		body = <ActivityIndicator color={colors.accent} style={styles.loading} />;
	} else if (searched && results.length === 0) {
		body = (
			<View style={styles.empty}>
				<Text style={styles.emptyTitle}>No tracks found for "{searched}"</Text>
				<Text style={styles.hint}>Check the spelling, or search for the artist instead.</Text>
			</View>
		);
	} else if (results.length > 0) {
		body = (
			<Animated.View entering={FadeIn.duration(150)} style={[styles.list, searching && styles.stale]}>
				{results.map((result, index) => (
					<ResultRow
						key={result.providerId}
						result={result}
						verb={verb}
						adding={adding === result.providerId}
						disabled={adding !== null}
						last={index === results.length - 1}
						onPress={() => add(result)}
					/>
				))}
			</Animated.View>
		);
	}

	return (
		<Screen title={`${verb} a track`} onClose={() => router.back()}>
			<View style={styles.content}>
				<TextField
					label="Search Deezer"
					value={text}
					onChangeText={setText}
					placeholder="Title or artist"
					autoFocus
					autoCorrect={false}
					returnKeyType="search"
					onSubmitEditing={() => words.length >= MIN_LETTERS && search(words)}
				/>
				{body}
			</View>
		</Screen>
	);
}

type RowProps = {
	result: TrackResult;
	verb: string;
	adding: boolean;
	disabled: boolean;
	last: boolean;
	onPress: () => void;
};

// One search result: cover, title, artist, length and the add sign
function ResultRow({ result, verb, adding, disabled, last, onPress }: RowProps) {
	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			accessibilityRole="button"
			accessibilityLabel={`${verb} ${result.title} by ${result.artist}`}
			accessibilityState={{ disabled, busy: adding }}
			style={({ pressed }) => [styles.row, !last && styles.rowLine, pressed && styles.pressed]}
		>
			{result.albumCoverUrl ? (
				<Image source={{ uri: result.albumCoverUrl }} style={styles.cover} />
			) : (
				<View style={[styles.cover, styles.noCover]}>
					<Ionicons name="musical-notes" size={20} color={colors.muted} />
				</View>
			)}
			<View style={styles.rowText}>
				<Text style={styles.title} numberOfLines={1}>
					{result.title}
				</Text>
				<Text style={styles.artist} numberOfLines={1}>
					{result.artist}
				</Text>
			</View>
			<Text style={styles.duration}>{formatDuration(result.durationMs)}</Text>
			<View style={styles.addSign}>
				{adding ? <ActivityIndicator size="small" color={colors.accent} /> : <Ionicons name="add" size={20} color={colors.accent} />}
			</View>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	content: {
		gap: space.xl,
	},
	hint: {
		...type.callout,
		color: colors.muted,
	},
	loading: {
		marginTop: space.xl,
	},
	empty: {
		gap: space.sm,
	},
	emptyTitle: {
		...type.headline,
		color: colors.ink,
	},
	list: {
		backgroundColor: colors.surface,
		borderRadius: radius.card,
		paddingHorizontal: 14,
	},
	// Old results stay readable while the next search runs
	stale: {
		opacity: 0.6,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.md,
		minHeight: 68,
	},
	rowLine: {
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: colors.line,
	},
	pressed: {
		opacity: 0.6,
	},
	cover: {
		width: 48,
		height: 48,
		borderRadius: 8,
	},
	noCover: {
		backgroundColor: colors.background,
		alignItems: 'center',
		justifyContent: 'center',
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
	duration: {
		...type.caption,
		fontWeight: '400',
		color: colors.muted,
		fontVariant: ['tabular-nums'],
	},
	addSign: {
		width: 32,
		height: 32,
		borderRadius: radius.pill,
		backgroundColor: colors.accentSoft,
		alignItems: 'center',
		justifyContent: 'center',
	},
});
