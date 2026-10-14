import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { createRoom } from '@/api/rooms';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TextField } from '@/components/TextField';
import { formatTime, TimeField } from '@/components/TimeField';
import { ErrorText } from '@/feedback/ErrorText';
import { useFeedback } from '@/feedback/FeedbackProvider';
import { currentPosition, LocationError } from '@/lib/location';
import { emptyRoomForm, validateRoomForm, type RoomForm, type RoomFormErrors } from '@/rooms/roomForm';
import { colors, radius, space, type } from '@/theme';
import type { AccessPolicy, RoomKind, Visibility } from '@/types/api';

const KINDS = [
	{ value: 'VOTE' as const, label: 'Track vote' },
	{ value: 'PLAYLIST' as const, label: 'Playlist' },
];
const VISIBILITIES = [
	{ value: 'PUBLIC' as const, label: 'Public' },
	{ value: 'PRIVATE' as const, label: 'Private' },
];
const RADII = [
	{ value: '100', label: '100 m' },
	{ value: '300', label: '300 m' },
	{ value: '1000', label: '1 km' },
];

const VISIBILITY_HINT: Record<Visibility, string> = {
	PUBLIC: 'Anyone can find this room.',
	PRIVATE: 'Only people you invite can find this room.',
};

// Place and time rules exist for track votes only (V.2.1)
function licenseOptions(kind: RoomKind) {
	const options: { value: AccessPolicy; label: string }[] = [
		{ value: 'OPEN', label: 'Everyone' },
		{ value: 'INVITE_ONLY', label: 'Invited' },
	];
	if (kind === 'VOTE') options.push({ value: 'RESTRICTED', label: 'Place and time' });
	return options;
}

function licenseHint(kind: RoomKind, license: AccessPolicy): string {
	const verb = kind === 'VOTE' ? 'vote' : 'edit';
	if (license === 'INVITE_ONLY') return `Only people you invite can ${verb}.`;
	if (license === 'RESTRICTED') return 'Only people at the place, during the hours below, can vote.';
	return `Anyone who finds the room can ${verb}.`;
}

// New room form, opened as a sheet from the rooms list
export default function NewRoomScreen() {
	const { toast } = useFeedback();
	const [form, setForm] = useState<RoomForm>(() => emptyRoomForm());
	const [errors, setErrors] = useState<RoomFormErrors>({});
	const [locating, setLocating] = useState(false);
	const [locationError, setLocationError] = useState<unknown>(null);
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState<unknown>(null);

	const update = (changes: Partial<RoomForm>) => {
		setForm((current) => ({ ...current, ...changes }));
		setErrors({});
		setSaveError(null);
	};

	// A playlist can't keep the place-and-time rule
	const changeKind = (kind: RoomKind) =>
		update({ kind, license: kind === 'PLAYLIST' && form.license === 'RESTRICTED' ? 'OPEN' : form.license });

	// Room's place = where the phone is now
	const locate = async () => {
		setLocating(true);
		setLocationError(null);
		try {
			update({ position: await currentPosition() });
		} catch (error) {
			setLocationError(error);
		} finally {
			setLocating(false);
		}
	};

	// Checks the form, creates the room, then opens it
	const submit = async () => {
		const result = validateRoomForm(form);
		if (!result.ok) {
			setErrors(result.errors);
			return;
		}
		setSaving(true);
		try {
			const room = await createRoom(result.input);
			toast('Room created', 'success');
			router.dismiss();
			router.push(`/rooms/${room.id}`);
		} catch (error) {
			setSaveError(error);
			setSaving(false);
		}
	};

	const restricted = form.license === 'RESTRICTED';
	const crossesMidnight =
		form.end.getHours() * 60 + form.end.getMinutes() <= form.start.getHours() * 60 + form.start.getMinutes();

	return (
		<Screen title="New room" onClose={() => router.dismiss()}>
			<View style={styles.form}>
				<TextField
					label="Name"
					value={form.name}
					onChangeText={(name) => update({ name })}
					error={errors.name}
					placeholder="Rooftop Friday"
					maxLength={120}
					returnKeyType="next"
				/>
				<TextField
					label="Description (optional)"
					value={form.description}
					onChangeText={(description) => update({ description })}
					placeholder="What's the vibe?"
					maxLength={500}
				/>

				<SegmentedControl label="Type" options={KINDS} value={form.kind} onChange={changeKind} />

				<Animated.View layout={LinearTransition.duration(220)} style={styles.group}>
					<SegmentedControl
						label="Who can see it"
						options={VISIBILITIES}
						value={form.visibility}
						onChange={(visibility) => update({ visibility })}
					/>
					<Text style={styles.hint}>{VISIBILITY_HINT[form.visibility]}</Text>
				</Animated.View>

				<Animated.View layout={LinearTransition.duration(220)} style={styles.group}>
					<SegmentedControl
						label={form.kind === 'VOTE' ? 'Who can vote' : 'Who can edit'}
						options={licenseOptions(form.kind)}
						value={form.license}
						onChange={(license) => update({ license })}
					/>
					<Text style={styles.hint}>{licenseHint(form.kind, form.license)}</Text>
				</Animated.View>

				{restricted && (
					<Animated.View
						entering={FadeInDown.duration(220)}
						exiting={FadeOut.duration(150)}
						layout={LinearTransition.duration(220)}
						style={styles.card}
					>
						<Text style={styles.cardTitle}>Place</Text>
						{form.position && (
							<View style={styles.placeSet}>
								<Ionicons name="checkmark-circle" size={18} color={colors.live} />
								<Text style={styles.placeSetText}>Place set where you are now</Text>
							</View>
						)}
						<Button
							label="Use my current location"
							variant="secondary"
							icon="locate"
							loading={locating}
							onPress={locate}
						/>
						<ErrorText error={locationError} />
						{locationError instanceof LocationError && locationError.reason === 'denied' && (
							<Button label="Open phone settings" variant="quiet" onPress={() => Linking.openSettings()} />
						)}
						<ErrorText message={errors.position} />
						<SegmentedControl
							label="Radius"
							options={RADII}
							value={String(form.radiusM)}
							onChange={(radius) => update({ radiusM: Number(radius) })}
						/>

						<Text style={[styles.cardTitle, styles.timeTitle]}>Time</Text>
						<View style={styles.times}>
							<TimeField label="Opens at" value={form.start} onChange={(start) => update({ start })} />
							<TimeField label="Closes at" value={form.end} onChange={(end) => update({ end })} />
						</View>
						<ErrorText message={errors.time} />
						<Text style={styles.hint}>
							Votes open today from {formatTime(form.start)} to {formatTime(form.end)}
							{crossesMidnight ? ' (next day).' : '.'}
						</Text>
					</Animated.View>
				)}

				<Animated.View layout={LinearTransition.duration(220)} style={styles.group}>
					<Button label="Create room" onPress={submit} loading={saving} />
					<ErrorText error={saveError} />
				</Animated.View>
			</View>
		</Screen>
	);
}

const styles = StyleSheet.create({
	form: {
		gap: space.xl,
	},
	group: {
		gap: space.sm,
	},
	hint: {
		...type.caption,
		fontWeight: '400',
		color: colors.muted,
	},
	card: {
		backgroundColor: colors.surface,
		borderRadius: radius.card,
		padding: space.lg,
		gap: space.md,
	},
	cardTitle: {
		...type.headline,
		color: colors.ink,
	},
	timeTitle: {
		marginTop: space.sm,
	},
	placeSet: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.sm,
	},
	placeSetText: {
		...type.callout,
		color: colors.live,
	},
	times: {
		flexDirection: 'row',
		gap: space.lg,
	},
});
