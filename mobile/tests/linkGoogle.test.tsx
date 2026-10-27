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
const ME = { id: 'u1', displayName: 'Mia', email: 'mia@work.com', emailVerified: true, googleLinked: false };
let fetchMock: jest.Mock;

beforeEach(async () => {
	await AsyncStorage.clear();
	await tokenStorage.clear();
	await tokenStorage.set('token', SERVER);
	process.env.EXPO_PUBLIC_API_URL = SERVER;
	fetchMock = mockFetch();
	getIdToken.mockReset();
});

// Logged in as ME, the link route answers with `linked`; after a successful link
// GET /users/me says googleLinked, like the backend
function serve(linked: ReturnType<typeof reply>) {
	let done = false;
	fetchMock.mockImplementation(async (url: string) => {
		const path = url.replace(/^https?:\/\/[^/]+/, '');
		if (path === '/users/me') return reply(200, { ...ME, googleLinked: done });
		if (path === '/auth/google/link') {
			done = linked.ok;
			return linked;
		}
		return reply(404, { statusCode: 404, message: `No fake route for ${path}` });
	});
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
	it('links the Google account, says so, then shows it as linked', async () => {
		getIdToken.mockResolvedValue('google-token');
		serve(reply(200, { message: 'Google account linked successfully' }));
		await renderWithProviders(<ProfileScreen />);

		await pressLink();

		expect(await screen.findByText('Google account linked')).toBeTruthy();
		expect(await screen.findByText('Linked, you can log in with Google')).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Link Google account' })).toBeNull();
		expect(JSON.parse(linkCalls()[0][1].body)).toEqual({ idToken: 'google-token' });
	});

	it('shows Google as linked, with no button, when it already is', async () => {
		routeFetch(fetchMock, { '/users/me': reply(200, { ...ME, googleLinked: true }) });
		await renderWithProviders(<ProfileScreen />);

		expect(await screen.findByText('Linked, you can log in with Google')).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Link Google account' })).toBeNull();
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
