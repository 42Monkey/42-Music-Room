import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { acceptFriendRequest, listFriendRequests, listFriends } from '@/api/friends';
import { searchUsers } from '@/api/users';
import { Avatar } from '@/components/Avatar';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { ErrorState } from '@/feedback/ErrorState';
import { useFeedback } from '@/feedback/FeedbackProvider';
import { addFriend, type Relation } from '@/friends/relation';
import { useSearch } from '@/lib/useSearch';
import { useSession } from '@/session/SessionProvider';
import { colors, radius, space, type } from '@/theme';
import type { UserSummary } from '@/types/api';

// Find people by name or email and send them a friend request; tap someone to see their profile
export default function FindPeopleScreen() {
	const { user } = useSession();
	const { toast, showError } = useFeedback();
	// Where I stand with each person, from my friends and requests, then from what I do here
	const [relations, setRelations] = useState<Record<string, Relation> | null>(null);
	const [loadError, setLoadError] = useState<unknown>(null);
	const [busy, setBusy] = useState<string | null>(null);
	const find = useCallback((words: string) => searchUsers(words), []);
	const search = useSearch(find);

	const loadRelations = useCallback(async () => {
		setLoadError(null);
		try {
			const [friends, requests] = await Promise.all([listFriends(), listFriendRequests()]);
			const known: Record<string, Relation> = {};
			for (const friend of friends) known[friend.id] = 'friend';
			for (const request of requests) known[request.senderId] = 'received';
			setRelations(known);
		} catch (error) {
			setLoadError(error);
		}
	}, []);

	useEffect(() => {
		loadRelations();
	}, [loadRelations]);

	const relationOf = (person: UserSummary): Relation => relations?.[person.id] ?? 'none';

	// Add or accept, one person at a time
	const act = async (person: UserSummary) => {
		if (busy) return;
		const accepting = relationOf(person) === 'received';
		setBusy(person.id);
		try {
			let next: Relation;
			if (accepting) {
				await acceptFriendRequest(person.id);
				next = 'friend';
			} else {
				next = await addFriend(person.id);
			}
			setRelations((current) => ({ ...current, [person.id]: next }));
			if (next === 'friend') toast(`You and ${person.displayName} are now friends`, 'success');
			else toast(`Request sent to ${person.displayName}`, 'success');
		} catch (error) {
			showError(error);
		} finally {
			setBusy(null);
		}
	};

	// Nobody adds themselves
	const people = search.results.filter((person) => person.id !== user?.id);

	let body = null;
	if (loadError) {
		body = <ErrorState error={loadError} onRetry={loadRelations} />;
	} else if (search.error) {
		body = <ErrorState error={search.error} onRetry={search.searchNow} />;
	} else if (search.tooShort) {
		body = <Text style={styles.hint}>Search people by name or email, then send them a friend request.</Text>;
	} else if (people.length === 0 && (search.searching || !relations)) {
		body = <ActivityIndicator color={colors.accent} style={styles.loading} />;
	} else if (search.searched && people.length === 0) {
		body = (
			<View style={styles.empty}>
				<Text style={styles.emptyTitle}>Nobody found for "{search.searched}"</Text>
				<Text style={styles.hint}>Check the spelling, or try their email.</Text>
			</View>
		);
	} else if (people.length > 0) {
		body = (
			<Animated.View entering={FadeIn.duration(150)} style={[styles.list, search.searching && styles.stale]}>
				{people.map((person, index) => (
					<PersonRow
						key={person.id}
						person={person}
						relation={relationOf(person)}
						busy={busy === person.id}
						ready={relations !== null}
						last={index === people.length - 1}
						onPress={() => act(person)}
					/>
				))}
			</Animated.View>
		);
	}

	return (
		<Screen title="Find people" back={{ label: 'Friends', onPress: () => router.back() }}>
			<View style={styles.content}>
				<TextField
					label="Search people"
					value={search.text}
					onChangeText={search.setText}
					placeholder="Name or email"
					autoCapitalize="none"
					autoCorrect={false}
					autoFocus
					returnKeyType="search"
					onSubmitEditing={search.searchNow}
				/>
				{body}
			</View>
		</Screen>
	);
}

type RowProps = {
	person: UserSummary;
	relation: Relation;
	busy: boolean;
	// Buttons wait until friends and requests are known
	ready: boolean;
	last: boolean;
	onPress: () => void;
};

// One person: avatar, name, and Add / Accept, or where things stand
function PersonRow({ person, relation, busy, ready, last, onPress }: RowProps) {
	let right;
	if (busy || !ready) {
		right = <ActivityIndicator size="small" color={colors.accent} />;
	} else if (relation === 'friend' || relation === 'sent') {
		right = (
			<View style={styles.done}>
				<Ionicons name={relation === 'friend' ? 'people' : 'checkmark'} size={16} color={colors.live} />
				<Text style={styles.doneText}>{relation === 'friend' ? 'Friends' : 'Sent'}</Text>
			</View>
		);
	} else {
		const label = relation === 'received' ? 'Accept' : 'Add';
		right = (
			<Pressable
				onPress={onPress}
				accessibilityRole="button"
				accessibilityLabel={`${label} ${person.displayName}`}
				hitSlop={8}
				style={({ pressed }) => [styles.action, pressed && styles.pressed]}
			>
				<Text style={styles.actionText}>{label}</Text>
			</Pressable>
		);
	}

	return (
		<Pressable
			onPress={() => router.push(`/friends/${person.id}`)}
			accessibilityRole="button"
			accessibilityLabel={`Open ${person.displayName}'s profile`}
			style={({ pressed }) => [styles.row, !last && styles.rowLine, pressed && styles.pressed]}
		>
			<Avatar name={person.displayName} url={person.avatarUrl} />
			<Text style={styles.name} numberOfLines={1}>
				{person.displayName}
			</Text>
			{right}
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
		paddingHorizontal: space.lg,
	},
	// Old results stay readable while the next search runs
	stale: {
		opacity: 0.6,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.md,
		minHeight: 60,
	},
	rowLine: {
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: colors.line,
	},
	pressed: {
		opacity: 0.6,
	},
	name: {
		...type.headline,
		fontSize: 16,
		color: colors.ink,
		flex: 1,
	},
	action: {
		paddingVertical: 6,
		paddingHorizontal: 14,
		borderRadius: radius.pill,
		backgroundColor: colors.accent,
	},
	actionText: {
		...type.caption,
		fontWeight: '700',
		color: '#FFFFFF',
	},
	done: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.xs,
	},
	doneText: {
		...type.caption,
		fontWeight: '600',
		color: colors.live,
	},
});
