import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/Avatar';
import { Tag } from '@/components/Tag';
import { colors, radius, space, type } from '@/theme';
import type { Profile, User } from '@/types/api';

// Birth date comes back as midnight UTC, shown in UTC so it never moves a day
function formatBirthDate(iso: string) {
	return new Date(iso).toLocaleDateString(undefined, { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
}

// Who is looking: me, a friend (sees contact details) or anyone else
export type SeenAs = 'self' | 'friend' | 'other';

type Props = {
	// Own profile comes with email and birth date, someone else's without
	user: Profile & Partial<Pick<User, 'email' | 'birthDate'>>;
	seenAs: SeenAs;
};

// A profile grouped by who can see each part (V.1), "who can see" hints on my own only
export function ProfileView({ user, seenAs }: Props) {
	const genres = user.musicPreference?.genres ?? [];
	const self = seenAs === 'self';

	return (
		<View>
			<View style={styles.top}>
				<Avatar name={user.displayName} url={user.avatarUrl} size={96} style={styles.avatar} />
				<Text style={styles.name} accessibilityRole="header">
					{user.displayName}
				</Text>
				{user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
			</View>

			<Section title={self ? 'Music I like' : 'Music'} hint={self ? 'Everyone' : undefined} icon="globe-outline">
				{genres.length > 0 ? (
					<View style={styles.genres}>
						{genres.map((genre) => (
							<Tag key={genre} label={genre} tone="accent" />
						))}
					</View>
				) : (
					<Text style={styles.notSet}>Nothing yet</Text>
				)}
			</Section>

			<Section title="Contact" hint={self ? 'Friends only' : undefined} icon="people-outline">
				{seenAs === 'other' ? (
					<Text style={styles.notSet}>Only friends can see this</Text>
				) : (
					<>
						<Row label="Location" value={user.location ?? null} />
						<Row label="Phone" value={user.phoneNumber ?? null} last />
					</>
				)}
			</Section>

			{self && (
				<Section title="Private" hint="Only you" icon="lock-closed-outline">
					<Row label="Email" value={user.email ?? null} />
					<Row label="Birth date" value={user.birthDate ? formatBirthDate(user.birthDate) : null} last />
				</Section>
			)}
		</View>
	);
}

type SectionProps = {
	title: string;
	hint?: string;
	icon: keyof typeof Ionicons.glyphMap;
	children: ReactNode;
};

// Card with its title and who can see it
function Section({ title, hint, icon, children }: SectionProps) {
	return (
		<View>
			<View style={styles.sectionHeader}>
				<Text style={styles.sectionTitle} accessibilityRole="header">
					{title}
				</Text>
				{hint && (
					<View style={styles.hint} accessibilityLabel={`Visible to: ${hint}`}>
						<Ionicons name={icon} size={13} color={colors.muted} />
						<Text style={styles.hintText}>{hint}</Text>
					</View>
				)}
			</View>
			<View style={styles.card}>{children}</View>
		</View>
	);
}

function Row({ label, value, last }: { label: string; value: string | null; last?: boolean }) {
	return (
		<View style={[styles.row, !last && styles.rowLine]}>
			<Text style={styles.rowLabel}>{label}</Text>
			<Text style={[styles.rowValue, !value && styles.rowEmpty]} numberOfLines={1}>
				{value || 'Not set'}
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	top: {
		alignItems: 'center',
		gap: space.sm,
		marginBottom: space.md,
	},
	avatar: {
		marginBottom: space.sm,
	},
	name: {
		...type.title,
		color: colors.ink,
		textAlign: 'center',
	},
	bio: {
		...type.callout,
		color: colors.muted,
		textAlign: 'center',
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
	hint: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.xs,
	},
	hintText: {
		...type.caption,
		color: colors.muted,
	},
	card: {
		backgroundColor: colors.surface,
		borderRadius: radius.card,
		paddingHorizontal: space.lg,
		paddingVertical: space.xs,
	},
	genres: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: space.sm,
		paddingVertical: space.md,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: space.md,
		paddingVertical: space.md,
	},
	rowLine: {
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: colors.line,
	},
	rowLabel: {
		...type.body,
		color: colors.ink,
	},
	rowValue: {
		...type.body,
		color: colors.ink,
		flexShrink: 1,
		textAlign: 'right',
	},
	rowEmpty: {
		color: colors.muted,
	},
	notSet: {
		...type.body,
		color: colors.muted,
		paddingVertical: space.md,
	},
});
