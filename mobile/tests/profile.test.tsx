import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import EditProfileScreen from '@/app/(app)/profile/edit';
import ProfileScreen from '@/app/(app)/profile/index';
import { DateField, formatDate } from '@/components/DateField';
import { genreChoices, genreLabel } from '@/profile/genres';
import {
	dayForServer,
	dayFromServer,
	isPhoneNumber,
	profileFormFrom,
	validateProfileForm,
	type ProfileForm,
} from '@/profile/profileForm';
import { ProfileView } from '@/profile/ProfileView';
import { tokenStorage } from '@/session/tokenStorage';
import type { User } from '@/types/api';
import { mockFetch, renderWithProviders, reply, SERVER } from './helpers';

const ME: User = {
	id: 'me',
	email: 'oleg@example.com',
	emailVerified: true,
	displayName: 'Oleg',
	role: 'USER',
	bio: 'Night owl',
	avatarUrl: null,
	location: 'Bangkok',
	phoneNumber: null,
	musicPreference: { genres: ['jazz'] },
	birthDate: '1995-05-15T00:00:00.000Z',
	googleLinked: false,
	createdAt: '2026-10-01T00:00:00.000Z',
	updatedAt: '2026-10-01T00:00:00.000Z',
};

function form(changes: Partial<ProfileForm> = {}): ProfileForm {
	return { ...profileFormFrom(ME), ...changes };
}

describe('validateProfileForm', () => {
	it('sends nothing when nothing changed', () => {
		expect(validateProfileForm(form(), ME)).toEqual({ ok: true, changes: {} });
	});

	it('sends only the fields that changed, trimmed', () => {
		const result = validateProfileForm(form({ displayName: '  Oleg P ', phoneNumber: '+33 6 12 34 56 78' }), ME);

		expect(result).toEqual({ ok: true, changes: { displayName: 'Oleg P', phoneNumber: '+33 6 12 34 56 78' } });
	});

	it('sends null for an emptied field, so it is really cleared', () => {
		const result = validateProfileForm(form({ bio: '   ', location: '' }), ME);

		expect(result).toEqual({ ok: true, changes: { bio: null, location: null } });
	});

	it('requires a name', () => {
		expect(validateProfileForm(form({ displayName: '  ' }), ME)).toEqual({
			ok: false,
			errors: { displayName: "Your name can't be empty." },
		});
	});

	it('uses the backend limits', () => {
		const result = validateProfileForm(
			form({ displayName: 'a'.repeat(51), bio: 'b'.repeat(501), location: 'c'.repeat(101) }),
			ME,
		);

		expect(result).toEqual({
			ok: false,
			errors: {
				displayName: 'Keep the name under 50 characters.',
				bio: 'Keep the bio under 500 characters.',
				location: 'Keep the location under 100 characters.',
			},
		});
	});

	it('refuses something that is not a phone number', () => {
		expect(validateProfileForm(form({ phoneNumber: 'call me' }), ME)).toEqual({
			ok: false,
			errors: { phoneNumber: 'Enter a phone number, like +33 6 12 34 56 78.' },
		});
	});

	it('sends the genres only when the set changed, whatever the order', () => {
		const user = { ...ME, musicPreference: { genres: ['jazz', 'rock'] } };

		expect(validateProfileForm({ ...profileFormFrom(user), genres: ['rock', 'jazz'] }, user)).toEqual({ ok: true, changes: {} });
		expect(validateProfileForm({ ...profileFormFrom(user), genres: ['rock'] }, user)).toEqual({
			ok: true,
			changes: { musicPreference: { genres: ['rock'] } },
		});
	});

	it('keeps the other music preference keys when the genres change', () => {
		const user = { ...ME, musicPreference: { genres: ['jazz'], mood: 'chill' } as User['musicPreference'] };

		const result = validateProfileForm({ ...profileFormFrom(user), genres: ['pop'] }, user);

		expect(result).toEqual({ ok: true, changes: { musicPreference: { genres: ['pop'], mood: 'chill' } } });
	});

	it('sends a new birth date as a day, and null when cleared', () => {
		expect(validateProfileForm(form({ birthDate: new Date(2001, 0, 2) }), ME)).toEqual({
			ok: true,
			changes: { birthDate: '2001-01-02' },
		});
		expect(validateProfileForm(form({ birthDate: null }), ME)).toEqual({ ok: true, changes: { birthDate: null } });
	});
});

describe('isPhoneNumber', () => {
	it.each(['+33 6 12 34 56 78', '0612345678', '(555) 123-4567', '+1.555.123.4567'])('accepts %s', (text) => {
		expect(isPhoneNumber(text)).toBe(true);
	});

	it.each(['hello', '12345', '1234567890123456', '06+1234567', '++336123456'])('refuses %s', (text) => {
		expect(isPhoneNumber(text)).toBe(false);
	});
});

describe('birth date days', () => {
	it('reads the backend date as that same day on the phone', () => {
		const day = dayFromServer('1995-05-15T00:00:00.000Z');

		expect([day.getFullYear(), day.getMonth(), day.getDate()]).toEqual([1995, 4, 15]);
	});

	it('writes a picked day the way the backend expects it', () => {
		expect(dayForServer(new Date(1995, 4, 5))).toBe('1995-05-05');
	});

	it('shows the day with a western year', () => {
		expect(formatDate(new Date(1995, 4, 15))).toBe('15 May 1995');
	});
});

describe('genres', () => {
	it('labels genres for display', () => {
		expect(genreLabel('jazz')).toBe('Jazz');
		expect(genreLabel('hip-hop')).toBe('Hip-hop');
		expect(genreLabel('r&b')).toBe('R&B');
	});

	it('adds genres the user has that are not in the list', () => {
		const choices = genreChoices(['jazz', 'chiptune']);

		expect(choices.filter((genre) => genre === 'jazz')).toHaveLength(1);
		expect(choices[choices.length - 1]).toBe('chiptune');
	});
});

describe('DateField', () => {
	it('starts an empty field from a button, then can be cleared', async () => {
		const onChange = jest.fn();
		const startAt = new Date(2000, 0, 1);
		const { rerender } = await render(
			<DateField label="Birth date" value={null} onChange={onChange} startAt={startAt} />,
		);

		await fireEvent.press(screen.getByRole('button', { name: 'Birth date, not set' }));
		expect(onChange).toHaveBeenLastCalledWith(startAt);

		await rerender(<DateField label="Birth date" value={startAt} onChange={onChange} startAt={startAt} />);
		await fireEvent.press(screen.getByRole('button', { name: 'Clear Birth date' }));
		expect(onChange).toHaveBeenLastCalledWith(null);
	});
});

describe('ProfileView', () => {
	it('shows everything on my own profile, with who can see each part', async () => {
		await render(<ProfileView user={ME} seenAs="self" />);

		expect(screen.getByText('Music I like')).toBeTruthy();
		expect(screen.getByText('Jazz')).toBeTruthy();
		expect(screen.getByText('Bangkok')).toBeTruthy();
		expect(screen.getByText('oleg@example.com')).toBeTruthy();
		expect(screen.getByText('15 May 1995')).toBeTruthy();
		expect(screen.getByLabelText('Visible to: Friends only')).toBeTruthy();
		expect(screen.getByLabelText('Visible to: Only you')).toBeTruthy();
	});

	it('shows a friend their contact details, not the private part', async () => {
		const { email, birthDate, ...profile } = ME;

		await render(<ProfileView user={profile} seenAs="friend" />);

		expect(screen.getByText('Music')).toBeTruthy();
		expect(screen.getByText('Bangkok')).toBeTruthy();
		expect(screen.queryByText('Private')).toBeNull();
		expect(screen.queryByLabelText(/Visible to/)).toBeNull();
	});

	it('shows anyone else only the public part', async () => {
		const profile = { id: 'me', displayName: 'Oleg', bio: null, avatarUrl: null, musicPreference: null };

		await render(<ProfileView user={profile} seenAs="other" />);

		expect(screen.getByText('Oleg')).toBeTruthy();
		expect(screen.getByText('Nothing yet')).toBeTruthy();
		expect(screen.queryByText('Contact')).toBeNull();
		expect(screen.queryByText('Private')).toBeNull();
	});
});

describe('Profile screens', () => {
	let fetchMock: jest.Mock;

	beforeEach(async () => {
		await AsyncStorage.clear();
		await tokenStorage.clear();
		await tokenStorage.set('token', SERVER);
		process.env.EXPO_PUBLIC_API_URL = SERVER;
		fetchMock = mockFetch();
		(router.dismiss as jest.Mock).mockClear();
	});

	// Logged in as ME; PATCH /users/me answers with `saved`
	function serve(saved: unknown = reply(200, ME)) {
		fetchMock.mockImplementation(async (url: string, init: { method: string }) => {
			const path = url.replace(/^https?:\/\/[^/]+/, '');
			if (path === '/users/me') return init.method === 'PATCH' ? saved : reply(200, ME);
			return reply(404, { statusCode: 404, message: 'Not found' });
		});
	}

	const patchCalls = () => fetchMock.mock.calls.filter(([, init]) => init.method === 'PATCH');

	it('shows my profile from the session, with no extra request', async () => {
		serve();

		await renderWithProviders(<ProfileScreen />);

		expect(await screen.findByText('Night owl')).toBeTruthy();
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('opens the edit sheet from the pencil', async () => {
		serve();
		await renderWithProviders(<ProfileScreen />);

		await fireEvent.press(await screen.findByRole('button', { name: 'Edit profile' }));

		expect(router.push).toHaveBeenCalledWith('/profile/edit');
	});

	it('saves only what changed and closes', async () => {
		serve(reply(200, { ...ME, bio: 'Early bird' }));
		await renderWithProviders(<EditProfileScreen />);

		await fireEvent.changeText(await screen.findByLabelText('Bio (optional)'), 'Early bird');
		await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

		await waitFor(() => expect(router.dismiss).toHaveBeenCalled());
		expect(JSON.parse(patchCalls()[0][1].body)).toEqual({ bio: 'Early bird' });
		expect(screen.getByText('Profile saved')).toBeTruthy();
	});

	it('picks a genre', async () => {
		serve();
		await renderWithProviders(<EditProfileScreen />);

		await fireEvent.press(await screen.findByRole('checkbox', { name: 'Rock' }));
		await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

		await waitFor(() => expect(patchCalls()).toHaveLength(1));
		expect(JSON.parse(patchCalls()[0][1].body)).toEqual({ musicPreference: { genres: ['jazz', 'rock'] } });
	});

	it('shows form errors and sends nothing', async () => {
		serve();
		await renderWithProviders(<EditProfileScreen />);

		await fireEvent.changeText(await screen.findByLabelText('Name'), ' ');
		await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

		expect(await screen.findByText("Your name can't be empty.")).toBeTruthy();
		expect(patchCalls()).toHaveLength(0);
	});

	it('closes without a request when nothing changed', async () => {
		serve();
		await renderWithProviders(<EditProfileScreen />);

		await fireEvent.press(await screen.findByRole('button', { name: 'Save' }));

		expect(router.dismiss).toHaveBeenCalled();
		expect(patchCalls()).toHaveLength(0);
	});

	it('stays open with the error when saving fails', async () => {
		serve(reply(500, { statusCode: 500, message: 'Internal server error' }));
		await renderWithProviders(<EditProfileScreen />);

		await fireEvent.changeText(await screen.findByLabelText('Location (optional)'), 'Paris');
		await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

		await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
		expect(router.dismiss).not.toHaveBeenCalled();
		expect(screen.getByLabelText('Location (optional)').props.value).toBe('Paris');
	});
});
