import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { configureApi } from '@/api/client';
import { linkGoogle } from '@/api/auth';
import ProfileScreen from '@/app/(app)/profile/index';
import { getGoogleIdToken } from '@/auth/google';
import { tokenStorage } from '@/session/tokenStorage';
import { mockFetch, renderWithProviders, reply, routeFetch, SERVER } from './helpers';

// The browser part is tested in google.test.ts, here it answers right away
jest.mock('@/auth/google', () => ({ getGoogleIdToken: jest.fn() }));

const getIdToken = getGoogleIdToken as jest.Mock;
const ME = { id: 'u1', displayName: 'Mia', email: 'mia@work.com', emailVerified: true };
let fetchMock: jest.Mock;

beforeEach(async () => {
	await AsyncStorage.clear();
	await tokenStorage.clear();
	await tokenStorage.set('token', SERVER);
	process.env.EXPO_PUBLIC_API_URL = SERVER;
	fetchMock = mockFetch();
	getIdToken.mockReset();
});

// Logged in as ME, the link route answers with `linked`
function serve(linked: unknown) {
	routeFetch(fetchMock, { '/users/me': reply(200, ME), '/auth/google/link': linked });
}

const linkCalls = () => fetchMock.mock.calls.filter(([url]) => url.endsWith('/auth/google/link'));

async function pressLink() {
	await fireEvent.press(await screen.findByRole('button', { name: 'Link Google account' }));
}

describe('linkGoogle', () => {
	it('sends the id token to the link route with the login', async () => {
		configureApi({ baseUrl: SERVER, token: 'access' });
		fetchMock.mockResolvedValue(reply(200, { message: 'Google account linked successfully' }));

		await linkGoogle('google-token');

		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe(`${SERVER}/auth/google/link`);
		expect(init.method).toBe('POST');
		expect(init.headers.Authorization).toBe('Bearer access');
		expect(JSON.parse(init.body)).toEqual({ idToken: 'google-token' });
	});
});

describe('Link Google account', () => {
	it('links the Google account and says so', async () => {
		getIdToken.mockResolvedValue('google-token');
		serve(reply(200, { message: 'Google account linked successfully' }));
		await renderWithProviders(<ProfileScreen />);

		await pressLink();

		expect(await screen.findByText('Google account linked')).toBeTruthy();
		expect(JSON.parse(linkCalls()[0][1].body)).toEqual({ idToken: 'google-token' });
	});

	it('says when this Google account was already linked to me', async () => {
		getIdToken.mockResolvedValue('google-token');
		serve(reply(200, { message: 'Google account already linked to this profile' }));
		await renderWithProviders(<ProfileScreen />);

		await pressLink();

		expect(await screen.findByText('This Google account is already linked to you')).toBeTruthy();
	});

	it("explains when the Google account is someone else's", async () => {
		getIdToken.mockResolvedValue('google-token');
		serve(reply(409, { statusCode: 409, message: 'This Google account is already linked to a different account' }));
		await renderWithProviders(<ProfileScreen />);

		await pressLink();

		expect(
			await screen.findByText('This Google account is linked to someone else. Use another Google account.'),
		).toBeTruthy();
	});

	it('does nothing when the browser is closed', async () => {
		getIdToken.mockResolvedValue(null);
		serve(reply(200, { message: 'Google account linked successfully' }));
		await renderWithProviders(<ProfileScreen />);

		await pressLink();

		await waitFor(() => expect(screen.getByRole('button', { name: 'Link Google account' })).toBeEnabled());
		expect(linkCalls()).toHaveLength(0);
		expect(screen.queryByText('Google account linked')).toBeNull();
	});
});
