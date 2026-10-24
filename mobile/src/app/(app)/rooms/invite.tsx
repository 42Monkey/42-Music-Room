import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { ApiError } from '@/api/errors';
import { inviteMember, listMembers, removeMember, searchUsers } from '@/api/members';
import { Avatar } from '@/components/Avatar';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { ErrorState } from '@/feedback/ErrorState';
import { useFeedback } from '@/feedback/FeedbackProvider';
import { useSearch } from '@/lib/useSearch';
import { useSession } from '@/session/SessionProvider';
import { colors, radius, space, type } from '@/theme';
import type { UserSummary } from '@/types/api';

// Server answers meaning "it was already that way"
const ALREADY_INVITED = 'User is already a member of this room';
const ALREADY_GONE = 'User is not a member of this room';

function toggled(ids: Set<string>, id: string, on: boolean): Set<string> {
	const next = new Set(ids);
	if (on) next.add(id);
	else next.delete(id);
	return next;
}

// Owner's sheet: tap a person to invite them, tap again to take the invite back
export default function InviteScreen() {
	const { roomId } = useLocalSearchParams<{ roomId: string }>();
	const { user } = useSession();
	const { toast, showError } = useFeedback();
	// People shown under "Invited": loaded ones, plus anyone changed during this visit
	const [listed, setListed] = useState<UserSummary[] | null>(null);
	const [invited, setInvited] = useState<Set<string>>(() => new Set());
	const [loadError, setLoadError] = useState<unknown>(null);
	const [busy, setBusy] = useState<string | null>(null);
	const find = useCallback((words: string) => searchUsers(words), []);
	const search = useSearch(find);

	const loadMembers = useCallback(async () => {
		setLoadError(null);
		try {
			const members = await listMembers(String(roomId));
			setListed(members.map((member) => member.user));
			setInvited(new Set(members.map((member) => member.userId)));
		} catch (error) {
			setLoadError(error);
		}
	}, [roomId]);

	useEffect(() => {
		loadMembers();
	}, [loadMembers]);

	const setState = (person: UserSummary, on: boolean) => {
		setInvited((current) => toggled(current, person.id, on));
		// Kept in the list even once removed, so a wrong tap is undone with another tap
		setListed((current) =>
			current && !current.some((shown) => shown.id === person.id) ? [...current, person] : current,
		);
	};

	// Invite or take the invite back, one person at a time
	const toggle = async (person: UserSummary) => {
		if (busy) return;
		const wasInvited = invited.has(person.id);
		setBusy(person.id);
		try {
			if (wasInvited) await removeMember(String(roomId), person.id);
			else await inviteMember(String(roomId), person.id);
			setState(person, !wasInvited);
			toast(`${person.displayName} ${wasInvited ? 'removed' : 'invited'}`, 'success');
		} catch (error) {
			const already = error instanceof ApiError && [ALREADY_INVITED, ALREADY_GONE].includes(String(error.serverMessage));
			if (already) setState(person, !wasInvited);
			else showError(error);
		} finally {
			setBusy(null);
		}
	};

	const row = (person: UserSummary, index: number, all: UserSummary[]) => (
		<PersonRow
			key={person.id}
			person={person}
			invited={invited.has(person.id)}
			busy={busy === person.id}
			last={index === all.length - 1}
			onPress={() => toggle(person)}
		/>
	);

	// The owner never needs an invite to their own room
	const people = search.results.filter((person) => person.id !== user?.id);

	let body = null;
	if (search.error) {
		body = <ErrorState error={search.error} onRetry={search.searchNow} />;
	} else if (!search.tooShort) {
		if (people.length === 0 && search.searching) {
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
					{people.map(row)}
				</Animated.View>
			);
		}
	} else if (loadError) {
		body = <ErrorState error={loadError} onRetry={loadMembers} />;
	} else if (!listed) {
		body = <ActivityIndicator color={colors.accent} style={styles.loading} />;
	} else if (listed.length === 0) {
		body = <Text style={styles.hint}>Nobody is invited yet. Search people by name or email.</Text>;
	} else {
		body = (
			<View style={styles.section}>
				<Text style={styles.sectionTitle} accessibilityRole="header">
					Invited ({invited.size})
				</Text>
				<View style={styles.list}>{listed.map(row)}</View>
			</View>
		);
	}

	return (
		<Screen title="Invite people" onClose={() => router.back()}>
			<View style={styles.content}>
				<TextField
					label="Search people"
					value={search.text}
					onChangeText={search.setText}
					placeholder="Name or email"
					autoCapitalize="none"
					autoCorrect={false}
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
	invited: boolean;
	busy: boolean;
	last: boolean;
	onPress: () => void;
};

// One person: avatar or initial, name, and whether they are invited
function PersonRow({ person, invited, busy, last, onPress }: RowProps) {
	return (
		<Pressable
			onPress={onPress}
			disabled={busy}
			accessibilityRole="button"
			accessibilityLabel={`${invited ? 'Remove' : 'Invite'} ${person.displayName}`}
			accessibilityState={{ selected: invited, busy }}
			style={({ pressed }) => [styles.row, !last && styles.rowLine, pressed && styles.pressed]}
		>
			<Avatar name={person.displayName} url={person.avatarUrl} />
			<Text style={styles.name} numberOfLines={1}>
				{person.displayName}
			</Text>
			{busy ? (
				<ActivityIndicator size="small" color={colors.accent} />
			) : invited ? (
				<View style={styles.done}>
					<Ionicons name="checkmark" size={16} color={colors.live} />
					<Text style={styles.doneText}>Invited</Text>
				</View>
			) : (
				<View style={styles.action}>
					<Text style={styles.actionText}>Invite</Text>
				</View>
			)}
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
	section: {
		gap: space.md,
	},
	sectionTitle: {
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
		paddingHorizontal: space.md,
		height: 32,
		borderRadius: radius.pill,
		backgroundColor: colors.accentSoft,
		justifyContent: 'center',
	},
	actionText: {
		...type.caption,
		fontSize: 14,
		fontWeight: '600',
		color: colors.accentText,
	},
	done: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.xs,
	},
	doneText: {
		...type.caption,
		color: colors.live,
	},
});
