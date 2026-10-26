import type { ProfileChanges, User } from '@/types/api';

export type ProfileForm = {
	displayName: string;
	bio: string;
	location: string;
	phoneNumber: string;
	genres: string[];
	birthDate: Date | null;
};

export type ProfileFormErrors = Partial<Record<keyof typeof PROFILE_LIMITS, string>>;

export type ProfileFormResult = { ok: true; changes: ProfileChanges } | { ok: false; errors: ProfileFormErrors };

// Same limits as the backend (UpdateProfileDto)
export const PROFILE_LIMITS = {
	displayName: 50,
	bio: 500,
	location: 100,
	phoneNumber: 30,
} as const;

const TOO_LONG: Record<keyof typeof PROFILE_LIMITS, string> = {
	displayName: 'Keep the name under 50 characters.',
	bio: 'Keep the bio under 500 characters.',
	location: 'Keep the location under 100 characters.',
	phoneNumber: 'Keep the phone number under 30 characters.',
};

// Digits with the usual separators, optional + in front, 6 to 15 digits (15 is the world maximum)
export function isPhoneNumber(text: string): boolean {
	if (!/^\+?[\d\s\-().]+$/.test(text)) return false;
	const digits = text.replace(/\D/g, '').length;
	return digits >= 6 && digits <= 15;
}

// Backend's birth date ("1995-05-15T00:00:00.000Z") as that day on the phone, whatever its time zone
export function dayFromServer(iso: string): Date {
	const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
	return new Date(year, month - 1, day);
}

// Picked day as the backend expects it: "1995-05-15"
export function dayForServer(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Same genres, whatever the order they were picked in
function sameGenres(a: string[], b: string[]): boolean {
	return a.length === b.length && a.every((genre) => b.includes(genre));
}

// Form filled with the current profile, empty boxes for what is not set
export function profileFormFrom(user: User): ProfileForm {
	return {
		displayName: user.displayName,
		bio: user.bio ?? '',
		location: user.location ?? '',
		phoneNumber: user.phoneNumber ?? '',
		genres: user.musicPreference?.genres ?? [],
		birthDate: user.birthDate ? dayFromServer(user.birthDate) : null,
	};
}

// Checks the form and builds the body for PATCH /users/me: only what changed, emptied = null
export function validateProfileForm(form: ProfileForm, user: User): ProfileFormResult {
	const errors: ProfileFormErrors = {};
	const trimmed = {
		displayName: form.displayName.trim(),
		bio: form.bio.trim(),
		location: form.location.trim(),
		phoneNumber: form.phoneNumber.trim(),
	};

	for (const field of Object.keys(trimmed) as (keyof typeof trimmed)[]) {
		if (trimmed[field].length > PROFILE_LIMITS[field]) errors[field] = TOO_LONG[field];
	}
	if (!trimmed.displayName) errors.displayName = "Your name can't be empty.";
	if (trimmed.phoneNumber && !errors.phoneNumber && !isPhoneNumber(trimmed.phoneNumber)) {
		errors.phoneNumber = 'Enter a phone number, like +33 6 12 34 56 78.';
	}

	if (Object.keys(errors).length > 0) return { ok: false, errors };

	const changes: ProfileChanges = {};
	if (trimmed.displayName !== user.displayName) changes.displayName = trimmed.displayName;
	if ((trimmed.bio || null) !== user.bio) changes.bio = trimmed.bio || null;
	if ((trimmed.location || null) !== user.location) changes.location = trimmed.location || null;
	if ((trimmed.phoneNumber || null) !== user.phoneNumber) changes.phoneNumber = trimmed.phoneNumber || null;
	// Whole preference object is replaced, so other keys in it are kept
	if (!sameGenres(form.genres, user.musicPreference?.genres ?? [])) {
		changes.musicPreference = { ...user.musicPreference, genres: form.genres };
	}
	const birthDate = form.birthDate && dayForServer(form.birthDate);
	if (birthDate !== (user.birthDate?.slice(0, 10) ?? null)) changes.birthDate = birthDate;
	return { ok: true, changes };
}
