import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import LoginScreen from '@/app/(auth)/login';
import { isEmail, validateLoginForm } from '@/auth/authForms';
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
