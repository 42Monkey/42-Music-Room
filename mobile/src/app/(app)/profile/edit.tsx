import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { updateMe } from '@/api/users';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { ErrorText } from '@/feedback/ErrorText';
import { useFeedback } from '@/feedback/FeedbackProvider';
import { GenrePicker } from '@/profile/GenrePicker';
import { genreChoices } from '@/profile/genres';
import {
	PROFILE_LIMITS,
	profileFormFrom,
	validateProfileForm,
	type ProfileForm,
	type ProfileFormErrors,
} from '@/profile/profileForm';
import { useSession } from '@/session/SessionProvider';
import { colors, space, type } from '@/theme';
import type { User } from '@/types/api';

// Edit my profile, opened as a sheet from the profile tab
export default function EditProfileScreen() {
	const { user } = useSession();
	// Always there while logged in, the tabs only show after login
	if (!user) return null;
	return <EditProfileForm user={user} />;
}

function EditProfileForm({ user }: { user: User }) {
	const { updateUser } = useSession();
	const { toast } = useFeedback();
	const [form, setForm] = useState<ProfileForm>(() => profileFormFrom(user));
	const [errors, setErrors] = useState<ProfileFormErrors>({});
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState<unknown>(null);
	const choices = useMemo(() => genreChoices(user.musicPreference?.genres ?? []), [user]);

	const update = (changes: Partial<ProfileForm>) => {
		setForm((current) => ({ ...current, ...changes }));
		setErrors({});
		setSaveError(null);
	};

	// Checks the form, sends only what changed, the profile tab shows the answer
	const submit = async () => {
		const result = validateProfileForm(form, user);
		if (!result.ok) {
			setErrors(result.errors);
			return;
		}
		if (Object.keys(result.changes).length === 0) {
			router.dismiss();
			return;
		}
		setSaving(true);
		try {
			updateUser(await updateMe(result.changes));
			toast('Profile saved', 'success');
			router.dismiss();
		} catch (error) {
			setSaveError(error);
			setSaving(false);
		}
	};

	return (
		<Screen title="Edit profile" onClose={() => router.dismiss()}>
			<View style={styles.form}>
				<Group title="Everyone can see">
					<TextField
						label="Name"
						value={form.displayName}
						onChangeText={(displayName) => update({ displayName })}
						error={errors.displayName}
						maxLength={PROFILE_LIMITS.displayName}
						autoComplete="name"
						textContentType="name"
					/>
					<TextField
						label="Bio (optional)"
						value={form.bio}
						onChangeText={(bio) => update({ bio })}
						error={errors.bio}
						placeholder="A few words about you"
						maxLength={PROFILE_LIMITS.bio}
						multiline
						style={styles.bio}
					/>
					<GenrePicker
						label="Music I like"
						choices={choices}
						value={form.genres}
						onChange={(genres) => update({ genres })}
					/>
				</Group>

				<Group title="Friends can see">
					<TextField
						label="Location (optional)"
						value={form.location}
						onChangeText={(location) => update({ location })}
						error={errors.location}
						placeholder="City, country"
						maxLength={PROFILE_LIMITS.location}
						textContentType="addressCity"
					/>
					<TextField
						label="Phone (optional)"
						value={form.phoneNumber}
						onChangeText={(phoneNumber) => update({ phoneNumber })}
						error={errors.phoneNumber}
						maxLength={PROFILE_LIMITS.phoneNumber}
						keyboardType="phone-pad"
						autoComplete="tel"
						textContentType="telephoneNumber"
					/>
				</Group>

				<View>
					<Button label="Save" onPress={submit} loading={saving} />
					<ErrorText error={saveError} />
				</View>
			</View>
		</Screen>
	);
}

function Group({ title, children }: { title: string; children: ReactNode }) {
	return (
		<View style={styles.group}>
			<Text style={styles.groupTitle} accessibilityRole="header">
				{title}
			</Text>
			{children}
		</View>
	);
}

const styles = StyleSheet.create({
	form: {
		gap: space.xxl,
	},
	group: {
		gap: space.lg,
	},
	groupTitle: {
		...type.headline,
		color: colors.ink,
	},
	bio: {
		minHeight: 104,
		paddingTop: space.md,
		paddingBottom: space.md,
		textAlignVertical: 'top',
	},
});
