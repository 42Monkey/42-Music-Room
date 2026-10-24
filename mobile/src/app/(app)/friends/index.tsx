import { useCallback, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { acceptFriendRequest, listFriendRequests, listFriends } from '@/api/friends';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ErrorState } from '@/feedback/ErrorState';
import { useFeedback } from '@/feedback/FeedbackProvider';
import { colors, radius, space, type } from '@/theme';
import type { FriendRequest, UserSummary } from '@/types/api';

type Lists = { friends: UserSummary[]; requests: FriendRequest[] };

// Friends tab: requests waiting for me, then my friends (V.1)
export default function FriendsScreen() {
	const { toast, showError } = useFeedback();
	const [lists, setLists] = useState<Lists | null>(null);
	const [error, setError] = useState<unknown>(null);
	const [refreshing, setRefreshing] = useState(false);
	const [accepting, setAccepting] = useState<string | null>(null);
	const shown = useRef(false);

	// Once something is on screen, a failed reload keeps it and says why in a toast
	const load = useCallback(async () => {
		try {
			const [friends, requests] = await Promise.all([listFriends(), listFriendRequests()]);
			setLists({ friends, requests });
			setError(null);
			shown.current = true;
		} catch (err) {
			if (shown.current) showError(err, { as: 'toast' });
			else setError(err);
		}
	}, [showError]);

	// Reload each time the tab comes back on screen: others send and accept requests meanwhile
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
		load();
	};

	// The person moves from requests to friends straight away
	const accept = async (request: FriendRequest) => {
		setAccepting(request.senderId);
		try {
			await acceptFriendRequest(request.senderId);
			setLists((current) =>
				current && {
					requests: current.requests.filter((r) => r.id !== request.id),
					friends: [request.sender, ...current.friends],
				},
			);
			toast(`You and ${request.sender.displayName} are now friends`, 'success');
		} catch (err) {
			showError(err, { as: 'toast' });
			load();
		} finally {
			setAccepting(null);
		}
	};

	return (
		<Screen
			title="Friends"
			refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
		>
			{error ? (
				<ErrorState error={error} onRetry={retry} />
			) : lists === null ? (
				<ActivityIndicator color={colors.accent} style={styles.loading} />
			) : (
				<>
					{lists.requests.length > 0 && (
						<>
							<SectionTitle title="Requests" count={lists.requests.length} />
							<View style={styles.list}>
								{lists.requests.map((request, index) => (
									<PersonRow key={request.id} person={request.sender} last={index === lists.requests.length - 1}>
										<Button
											label="Accept"
											onPress={() => accept(request)}
											loading={accepting === request.senderId}
											disabled={accepting !== null && accepting !== request.senderId}
											style={styles.accept}
										/>
									</PersonRow>
								))}
							</View>
						</>
					)}

					<SectionTitle title="Friends" count={lists.friends.length} />
					{lists.friends.length === 0 ? (
						<View style={styles.empty}>
							<Text style={styles.emptyTitle}>No friends yet</Text>
							<Text style={styles.emptyText}>People who accept your request, or whose request you accept, show up here.</Text>
						</View>
					) : (
						<View style={styles.list}>
							{lists.friends.map((friend, index) => (
								<PersonRow key={friend.id} person={friend} last={index === lists.friends.length - 1} />
							))}
						</View>
					)}
				</>
			)}
		</Screen>
	);
}

function SectionTitle({ title, count }: { title: string; count: number }) {
	return (
		<View style={styles.sectionHeader}>
			<Text style={styles.sectionTitle} accessibilityRole="header">
				{title}
			</Text>
			{count > 0 && <Text style={styles.count}>{count}</Text>}
		</View>
	);
}

type RowProps = {
	person: UserSummary;
	last: boolean;
	// Action on the right, like Accept
	children?: ReactNode;
};

// One person: avatar or initial, name, and an action
function PersonRow({ person, last, children }: RowProps) {
	return (
		<View style={[styles.row, !last && styles.rowLine]}>
			<Avatar name={person.displayName} url={person.avatarUrl} />
			<Text style={styles.name} numberOfLines={1}>
				{person.displayName}
			</Text>
			{children}
		</View>
	);
}

const styles = StyleSheet.create({
	loading: {
		marginTop: space.huge,
	},
	sectionHeader: {
		flexDirection: 'row',
		alignItems: 'baseline',
		justifyContent: 'space-between',
		marginTop: space.md,
		marginBottom: space.md,
	},
	sectionTitle: {
		...type.title,
		fontSize: 20,
		color: colors.ink,
	},
	count: {
		...type.caption,
		color: colors.muted,
	},
	list: {
		backgroundColor: colors.surface,
		borderRadius: radius.card,
		paddingHorizontal: space.lg,
		marginBottom: space.lg,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.md,
		paddingVertical: space.md,
	},
	rowLine: {
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: colors.line,
	},
	name: {
		...type.headline,
		fontSize: 16,
		color: colors.ink,
		flex: 1,
	},
	accept: {
		minHeight: 36,
		paddingHorizontal: space.lg,
	},
	empty: {
		paddingVertical: space.xl,
		gap: space.sm,
	},
	emptyTitle: {
		...type.headline,
		color: colors.ink,
	},
	emptyText: {
		...type.body,
		color: colors.muted,
	},
});
