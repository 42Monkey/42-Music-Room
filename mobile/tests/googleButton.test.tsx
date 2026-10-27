import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { googleLogin } from '@/api/auth';
import { configureApi } from '@/api/client';
import LoginScreen from '@/app/(auth)/login';
import RegisterScreen from '@/app/(auth)/register';
import { getGoogleIdToken } from '@/auth/google';
import { tokenStorage } from '@/session/tokenStorage';
import { mockFetch, renderWithProviders, reply, routeFetch, SERVER } from './helpers';

// The browser part is tested in google.test.ts, here it answers right away
jest.mock('@/auth/google', () => ({ getGoogleIdToken: jest.fn() }));

const getIdToken = getGoogleIdToken as jest.Mock;
const ME = { id: 'u1', displayName: 'Mia', email: 'mia@gmail.com', emailVerified: true };
const TOKENS = { accessToken: 'access', refreshToken: 'refresh' };
let fetchMock: jest.Mock;

beforeEach(async () => {
	await AsyncStorage.clear();
	await tokenStorage.clear();
	process.env.EXPO_PUBLIC_API_URL = SERVER;
	fetchMock = mockFetch();
	getIdToken.mockReset();
});

const pressGoogle = () => fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }));

describe('googleLogin', () => {
	it('sends the id token to the Google login route', async () => {
		configureApi({ baseUrl: SERVER, token: null });
		fetchMock.mockResolvedValue(reply(200, TOKENS));

		await expect(googleLogin('google-token')).resolves.toEqual(TOKENS);

		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe(`${SERVER}/auth/google/mobile`);
		expect(init.method).toBe('POST');
		expect(JSON.parse(init.body)).toEqual({ idToken: 'google-token' });
	});
});

describe('Continue with Google', () => {
	it('logs in with the token Google gave and keeps the login', async () => {
		getIdToken.mockResolvedValue('google-token');
		routeFetch(fetchMock, { '/auth/google/mobile': reply(200, TOKENS), '/users/me': reply(200, ME) });
		await renderWithProviders(<LoginScreen />);

		await pressGoogle();

		await waitFor(async () => expect((await tokenStorage.get())?.token).toBe('access'));
	});

	it('does nothing when the browser is closed', async () => {
		getIdToken.mockResolvedValue(null);
		await renderWithProviders(<LoginScreen />);

		await pressGoogle();

		await waitFor(() => expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeEnabled());
		expect(fetchMock).not.toHaveBeenCalled();
		expect(screen.queryByText('Something went wrong')).toBeNull();
	});

	it('shows what went wrong on the Google side', async () => {
		getIdToken.mockRejectedValue(new Error("Google didn't sign you in. Try again."));
		await renderWithProviders(<LoginScreen />);

		await pressGoogle();

		await waitFor(() => expect(screen.getByText("Google didn't sign you in. Try again.")).toBeTruthy());
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('says Google sign-in failed, not that the session ended, when the server refuses the token', async () => {
		getIdToken.mockResolvedValue('google-token');
		routeFetch(fetchMock, {
			'/auth/google/mobile': reply(401, { statusCode: 401, message: 'Invalid or expired Google ID token' }),
		});
		await renderWithProviders(<LoginScreen />);

		await pressGoogle();

		await waitFor(() => expect(screen.getByText("The server couldn't check your Google account. Try again.")).toBeTruthy());
		expect(screen.queryByText(/session expired/i)).toBeNull();
	});

	it('is on the sign-up screen too', async () => {
		getIdToken.mockResolvedValue('google-token');
		routeFetch(fetchMock, { '/auth/google/mobile': reply(200, TOKENS), '/users/me': reply(200, ME) });
		await renderWithProviders(<RegisterScreen />);

		await pressGoogle();

		await waitFor(async () => expect((await tokenStorage.get())?.token).toBe('access'));
	});
});
