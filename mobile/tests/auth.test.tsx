import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import LoginScreen from '@/app/(auth)/login';
import RegisterScreen from '@/app/(auth)/register';
import VerifyEmailScreen from '@/app/(auth)/verify-email';
import { PasswordField } from '@/components/PasswordField';
import {
	cleanCode,
	isEmail,
	validateEmail,
	validateLoginForm,
	validateRegisterForm,
	validateVerifyForm,
} from '@/auth/authForms';
import { tokenStorage } from '@/session/tokenStorage';
import { mockFetch, renderWithProviders, reply, routeFetch, SERVER } from './helpers';

const ME = { id: 'u1', displayName: 'Mia', email: 'mia@test.com', emailVerified: true };
const TOKENS = { accessToken: 'access', refreshToken: 'refresh' };
let fetchMock: jest.Mock;

beforeEach(async () => {
	await AsyncStorage.clear();
	await tokenStorage.clear();
	process.env.EXPO_PUBLIC_API_URL = SERVER;
	fetchMock = mockFetch();
	(router.push as jest.Mock).mockReset();
	(router.replace as jest.Mock).mockReset();
	(router.back as jest.Mock).mockReset();
	(useLocalSearchParams as jest.Mock).mockReturnValue({});
});

// Path and body of every call sent to the fake backend
function sentCalls() {
	return fetchMock.mock.calls.map(([url, init]) => ({
		path: url.replace(SERVER, ''),
		body: init.body ? JSON.parse(init.body) : undefined,
	}));
}

async function fillAndSubmit(email: string, password: string) {
	await fireEvent.changeText(screen.getByLabelText('Email'), email);
	await fireEvent.changeText(screen.getByLabelText('Password'), password);
	await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
}

describe('PasswordField', () => {
	it('hides the password until the eye is pressed, then hides it again', async () => {
		await renderWithProviders(<PasswordField label="Password" value="secret123" />);

		expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);

		await fireEvent.press(screen.getByRole('button', { name: 'Show password' }));
		expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false);

		await fireEvent.press(screen.getByRole('button', { name: 'Hide password' }));
		expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
	});
});

describe('isEmail', () => {
	it.each(['mia@test.com', 'mia+music@test.co.uk', 'Mia.K@Test.com'])('accepts %s', (text) => {
		expect(isEmail(text)).toBe(true);
	});

	it.each(['mia', 'mia@test', 'mia@testcom', '@test.com', 'mia @test.com', 'mia@@test.com'])('refuses %s', (text) => {
		expect(isEmail(text)).toBe(false);
	});
});

describe('validateLoginForm', () => {
	it('trims the email but keeps its capitals and the password as typed', () => {
		expect(validateLoginForm({ email: '  Mia@Test.com ', password: ' secret ' })).toEqual({
			ok: true,
			input: { email: 'Mia@Test.com', password: ' secret ' },
		});
	});

	it('requires both fields', () => {
		expect(validateLoginForm({ email: '   ', password: '' })).toEqual({
			ok: false,
			errors: { email: 'Enter your email.', password: 'Enter your password.' },
		});
	});

	it('refuses an email with a typo', () => {
		expect(validateLoginForm({ email: 'mia@testcom', password: 'secret123' })).toEqual({
			ok: false,
			errors: { email: 'Enter a valid email, like name@example.com.' },
		});
	});

	it('accepts a short password (only the backend knows if it is right)', () => {
		expect(validateLoginForm({ email: 'mia@test.com', password: 'abc' }).ok).toBe(true);
	});
});

describe('Login screen', () => {
	it('shows a typo in the email under the field and sends nothing', async () => {
		await renderWithProviders(<LoginScreen />);

		await fillAndSubmit('mia@testcom', 'secret123');

		expect(screen.getByText('Enter a valid email, like name@example.com.')).toBeTruthy();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('asks for the email and password before sending anything', async () => {
		await renderWithProviders(<LoginScreen />);

		await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));

		expect(screen.getByText('Enter your email.')).toBeTruthy();
		expect(screen.getByText('Enter your password.')).toBeTruthy();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('logs in with the trimmed email and keeps the login', async () => {
		routeFetch(fetchMock, { '/auth/login': reply(200, TOKENS), '/users/me': reply(200, ME) });
		await renderWithProviders(<LoginScreen />);

		await fillAndSubmit('  mia@test.com ', 'secret123');

		await waitFor(async () => expect((await tokenStorage.get())?.token).toBe('access'));
		expect(sentCalls()[0]).toEqual({ path: '/auth/login', body: { email: 'mia@test.com', password: 'secret123' } });
		expect(sentCalls()[1].path).toBe('/users/me');
	});

	it('says the email or password is wrong, not that the session ended', async () => {
		routeFetch(fetchMock, { '/auth/login': reply(401, { statusCode: 401, message: 'Invalid credentials' }) });
		await renderWithProviders(<LoginScreen />);

		await fillAndSubmit('mia@test.com', 'wrong-password');

		await waitFor(() => expect(screen.getByText('Check your email and password, then try again.')).toBeTruthy());
		expect(screen.queryByText(/session expired/i)).toBeNull();
	});

	it('opens the code screen when the email is not verified yet', async () => {
		routeFetch(fetchMock, {
			'/auth/login': reply(403, { statusCode: 403, message: 'Verify your email before logging in' }),
		});
		await renderWithProviders(<LoginScreen />);

		await fillAndSubmit('mia@test.com', 'secret123');

		await waitFor(() =>
			expect(router.push).toHaveBeenCalledWith({ pathname: '/verify-email', params: { email: 'mia@test.com' } }),
		);
		expect(screen.queryByText('Verify your email before logging in.')).toBeNull();
	});

	it.each([
		['Create an account', '/register'],
		['Forgot password?', '/forgot-password'],
		['Server settings', '/settings'],
	])('"%s" opens %s', async (label, path) => {
		await renderWithProviders(<LoginScreen />);

		await fireEvent.press(screen.getByRole('button', { name: label }));

		expect(router.push).toHaveBeenCalledWith(path);
	});
});

describe('validateRegisterForm', () => {
	const valid = { displayName: ' Mia K ', email: ' mia@test.com ', password: 'secret123' };

	it('trims the name and email but keeps the password as typed', () => {
		expect(validateRegisterForm({ ...valid, password: ' secret12 ' })).toEqual({
			ok: true,
			input: { displayName: 'Mia K', email: 'mia@test.com', password: ' secret12 ' },
		});
	});

	it('requires every field', () => {
		expect(validateRegisterForm({ displayName: ' ', email: '', password: '' })).toEqual({
			ok: false,
			errors: {
				displayName: 'Enter a name of at least 2 characters.',
				email: 'Enter your email.',
				password: 'Use at least 8 characters.',
			},
		});
	});

	it('keeps the name between 2 and 50 characters', () => {
		expect(validateRegisterForm({ ...valid, displayName: ' M ' }).ok).toBe(false);
		expect(validateRegisterForm({ ...valid, displayName: 'Mi' }).ok).toBe(true);
		expect(validateRegisterForm({ ...valid, displayName: 'a'.repeat(50) }).ok).toBe(true);
		expect(validateRegisterForm({ ...valid, displayName: 'a'.repeat(51) })).toEqual({
			ok: false,
			errors: { displayName: 'Keep the name under 50 characters.' },
		});
	});

	it('needs a password of at least 8 characters', () => {
		expect(validateRegisterForm({ ...valid, password: 'secret1' })).toEqual({
			ok: false,
			errors: { password: 'Use at least 8 characters.' },
		});
		expect(validateRegisterForm({ ...valid, password: 'secret12' }).ok).toBe(true);
	});


	it('refuses an email with a typo', () => {
		expect(validateRegisterForm({ ...valid, email: 'mia@testcom' })).toEqual({
			ok: false,
			errors: { email: 'Enter a valid email, like name@example.com.' },
		});
	});
});

describe('Register screen', () => {
	async function fillAndCreate(displayName: string, email: string, password: string) {
		await fireEvent.changeText(screen.getByLabelText('Name'), displayName);
		await fireEvent.changeText(screen.getByLabelText('Email'), email);
		await fireEvent.changeText(screen.getByLabelText('Password'), password);
		await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
	}

	it('shows what is wrong under each field and sends nothing', async () => {
		await renderWithProviders(<RegisterScreen />);

		await fillAndCreate('M', 'mia@testcom', 'short');

		expect(screen.getByText('Enter a name of at least 2 characters.')).toBeTruthy();
		expect(screen.getByText('Enter a valid email, like name@example.com.')).toBeTruthy();
		expect(screen.getByText('Use at least 8 characters.')).toBeTruthy();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('creates the account, then opens the code screen with the email', async () => {
		routeFetch(fetchMock, { '/auth/register': reply(201, { id: 'u1', email: 'mia@test.com', displayName: 'Mia K' }) });
		await renderWithProviders(<RegisterScreen />);

		await fillAndCreate(' Mia K ', ' mia@test.com ', 'secret123');

		await waitFor(() =>
			expect(router.replace).toHaveBeenCalledWith({ pathname: '/verify-email', params: { email: 'mia@test.com' } }),
		);
		expect(sentCalls()).toEqual([
			{ path: '/auth/register', body: { displayName: 'Mia K', email: 'mia@test.com', password: 'secret123' } },
		]);
		expect(screen.getByText('Account created')).toBeTruthy();
	});

	it('says when the email already has an account', async () => {
		routeFetch(fetchMock, { '/auth/register': reply(409, { statusCode: 409, message: 'Email already in use' }) });
		await renderWithProviders(<RegisterScreen />);

		await fillAndCreate('Mia K', 'mia@test.com', 'secret123');

		await waitFor(() =>
			expect(
				screen.getByText('An account already uses this email. Log in instead, or reset your password if you forgot it.'),
			).toBeTruthy(),
		);
		expect(router.replace).not.toHaveBeenCalled();
	});

	it('goes back to the login screen', async () => {
		await renderWithProviders(<RegisterScreen />);

		await fireEvent.press(screen.getByRole('button', { name: 'Back to Log in' }));

		expect(router.back).toHaveBeenCalled();
	});
});

describe('codes and single emails', () => {
	it('keeps only the digits of a typed or pasted code, 6 at most', () => {
		expect(cleanCode('123 456')).toBe('123456');
		expect(cleanCode('12-34-56-78')).toBe('123456');
		expect(cleanCode('abc')).toBe('');
	});

	it('checks an email on its own', () => {
		expect(validateEmail(' mia@test.com ')).toEqual({ ok: true, email: 'mia@test.com' });
		expect(validateEmail('mia@testcom')).toEqual({ ok: false, error: 'Enter a valid email, like name@example.com.' });
	});

	it('needs the email and a 6-digit code to verify', () => {
		expect(validateVerifyForm({ email: ' mia@test.com ', code: '123456' })).toEqual({
			ok: true,
			input: { email: 'mia@test.com', code: '123456' },
		});
		expect(validateVerifyForm({ email: '', code: '12345' })).toEqual({
			ok: false,
			errors: { email: 'Enter your email.', code: 'Enter the 6-digit code from the email.' },
		});
	});
});

describe('Verify email screen', () => {
	function openedFor(email: string) {
		(useLocalSearchParams as jest.Mock).mockReturnValue({ email });
	}

	it('says where the code was sent and asks only for the code', async () => {
		openedFor('mia@test.com');
		await renderWithProviders(<VerifyEmailScreen />);

		expect(screen.getByText('mia@test.com')).toBeTruthy();
		expect(screen.queryByLabelText('Email')).toBeNull();
		expect(screen.getByLabelText('Code')).toBeTruthy();
	});

	it('keeps only digits in the code field', async () => {
		openedFor('mia@test.com');
		await renderWithProviders(<VerifyEmailScreen />);

		await fireEvent.changeText(screen.getByLabelText('Code'), '123 456');

		expect(screen.getByLabelText('Code').props.value).toBe('123456');
	});

	it('asks for the whole code before sending anything', async () => {
		openedFor('mia@test.com');
		await renderWithProviders(<VerifyEmailScreen />);

		await fireEvent.changeText(screen.getByLabelText('Code'), '123');
		await fireEvent.press(screen.getByRole('button', { name: 'Verify email' }));

		expect(screen.getByText('Enter the 6-digit code from the email.')).toBeTruthy();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('verifies the email, then goes back to login', async () => {
		openedFor('mia+music@test.com');
		routeFetch(fetchMock, { '/auth/verify-email': reply(200, { message: 'Email verified succesfully' }) });
		await renderWithProviders(<VerifyEmailScreen />);

		await fireEvent.changeText(screen.getByLabelText('Code'), '123456');
		await fireEvent.press(screen.getByRole('button', { name: 'Verify email' }));

		await waitFor(() => expect(router.back).toHaveBeenCalled());
		expect(fetchMock.mock.calls[0][0]).toBe(`${SERVER}/auth/verify-email?email=mia%2Bmusic%40test.com&token=123456`);
		expect(screen.getByText('Email verified. Log in to continue.')).toBeTruthy();
	});

	it('says how to get out of a wrong or dead code', async () => {
		openedFor('mia@test.com');
		routeFetch(fetchMock, {
			'/auth/verify-email': reply(400, { statusCode: 400, message: 'Invalid or expired verification code' }),
		});
		await renderWithProviders(<VerifyEmailScreen />);

		await fireEvent.changeText(screen.getByLabelText('Code'), '999999');
		await fireEvent.press(screen.getByRole('button', { name: 'Verify email' }));

		await waitFor(() =>
			expect(screen.getByText("Check the code in the email, or send a new one if it's old.")).toBeTruthy(),
		);
		expect(router.back).not.toHaveBeenCalled();
	});

	it('sends a new code and empties the code field', async () => {
		openedFor('mia@test.com');
		routeFetch(fetchMock, { '/auth/resend-verification': reply(200, {}) });
		await renderWithProviders(<VerifyEmailScreen />);

		await fireEvent.changeText(screen.getByLabelText('Code'), '111111');
		await fireEvent.press(screen.getByRole('button', { name: 'Send a new code' }));

		await waitFor(() => expect(screen.getByText('New code sent')).toBeTruthy());
		expect(sentCalls()).toEqual([{ path: '/auth/resend-verification', body: { email: 'mia@test.com' } }]);
		expect(screen.getByLabelText('Code').props.value).toBe('');
	});

	it('asks for the email when it was not given', async () => {
		routeFetch(fetchMock, { '/auth/verify-email': reply(200, {}) });
		await renderWithProviders(<VerifyEmailScreen />);

		await fireEvent.changeText(screen.getByLabelText('Email'), ' mia@test.com ');
		await fireEvent.changeText(screen.getByLabelText('Code'), '123456');
		await fireEvent.press(screen.getByRole('button', { name: 'Verify email' }));

		await waitFor(() => expect(router.back).toHaveBeenCalled());
		expect(fetchMock.mock.calls[0][0]).toBe(`${SERVER}/auth/verify-email?email=mia%40test.com&token=123456`);
	});
});
