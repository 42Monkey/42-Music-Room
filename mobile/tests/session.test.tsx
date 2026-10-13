import type { ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, screen, waitFor } from '@testing-library/react-native';
import { api } from '@/api/client';
import { NetworkError } from '@/api/errors';
import { SessionProvider, useSession } from '@/session/SessionProvider';
import { SessionWatcher } from '@/session/SessionWatcher';
import { tokenStorage } from '@/session/tokenStorage';
import { SettingsProvider } from '@/settings/SettingsProvider';
import { mockFetch, renderWithProviders, reply } from './helpers';

const ME = { id: 'u1', displayName: 'Test User 1', email: 'user1@test.com', emailVerified: true };
let fetchMock: jest.Mock;

function wrapper({ children }: { children: ReactNode }) {
	return (
		<SettingsProvider>
			<SessionProvider>{children}</SessionProvider>
		</SettingsProvider>
	);
}

async function renderSession() {
	const view = await renderHook(() => useSession(), { wrapper });
	await waitFor(() => expect(view.result.current.status).not.toBe('loading'));
	return view;
}

beforeEach(async () => {
	await AsyncStorage.clear();
	await tokenStorage.clear();
	process.env.EXPO_PUBLIC_API_URL = 'http://192.168.1.10:8080';
	fetchMock = mockFetch();
});

describe('SessionProvider', () => {
	it('starts logged out without a saved token', async () => {
		const { result } = await renderSession();

		expect(result.current.status).toBe('signedOut');
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('restores the session from a saved token', async () => {
		await tokenStorage.set('saved-token');
		fetchMock.mockResolvedValue(reply(200, ME));

		const { result } = await renderSession();

		expect(result.current.status).toBe('signedIn');
		expect(result.current.user?.displayName).toBe('Test User 1');
		expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer saved-token');
	});

	it('forgets a token the server refuses', async () => {
		await tokenStorage.set('old-token');
		fetchMock.mockResolvedValue(reply(401, { statusCode: 401, message: 'Unauthorized' }));

		const { result } = await renderSession();

		expect(result.current.status).toBe('signedOut');
		expect(await tokenStorage.get()).toBeNull();
	});

	it('keeps the token and reports the error when the server is unreachable', async () => {
		await tokenStorage.set('saved-token');
		fetchMock.mockRejectedValue(new TypeError('Network request failed'));

		const { result } = await renderSession();

		expect(result.current.status).toBe('signedOut');
		expect(result.current.restoreError).toBeInstanceOf(NetworkError);
		expect(await tokenStorage.get()).toBe('saved-token');
	});

	it('signs in with the tokens from login', async () => {
		const { result } = await renderSession();
		fetchMock.mockResolvedValue(reply(200, ME));

		await act(() => result.current.signIn({ accessToken: 'new-token', refreshToken: 'r' }));

		expect(result.current.status).toBe('signedIn');
		expect(result.current.user?.id).toBe('u1');
		expect(await tokenStorage.get()).toBe('new-token');
	});

	it('signs out and forgets the token', async () => {
		await tokenStorage.set('saved-token');
		fetchMock.mockResolvedValue(reply(200, ME));
		const { result } = await renderSession();

		await act(() => result.current.signOut());

		expect(result.current.status).toBe('signedOut');
		expect(result.current.user).toBeNull();
		expect(await tokenStorage.get()).toBeNull();
	});

	it('ends the session when the server refuses the token later (watcher shows why)', async () => {
		await tokenStorage.set('saved-token');
		fetchMock.mockResolvedValue(reply(200, ME));
		await renderWithProviders(<SessionWatcher />);
		await waitFor(() => expect(fetchMock).toHaveBeenCalled());
		fetchMock.mockResolvedValue(reply(401, { statusCode: 401, message: 'Unauthorized' }));

		await act(async () => {
			await api.get('/rooms').catch(() => {});
		});

		await waitFor(() => expect(screen.getByText('Session ended')).toBeTruthy());
		expect(screen.getByText('Your session expired. Log in again to continue.')).toBeTruthy();
	});

	it('tells the user when the server is unreachable at startup', async () => {
		await tokenStorage.set('saved-token');
		fetchMock.mockRejectedValue(new TypeError('Network request failed'));

		await renderWithProviders(<SessionWatcher />);

		await waitFor(() => expect(screen.getByText("Can't reach the server")).toBeTruthy());
	});

	it('ends the session when the server refuses the token later', async () => {
		await tokenStorage.set('saved-token');
		fetchMock.mockResolvedValue(reply(200, ME));
		const { result } = await renderSession();
		fetchMock.mockResolvedValue(reply(401, { statusCode: 401, message: 'Unauthorized' }));

		await act(async () => {
			await api.get('/rooms').catch(() => {});
		});

		await waitFor(() => expect(result.current.status).toBe('signedOut'));
		expect(result.current.expired).toBe(true);
	});
});
