import * as WebBrowser from 'expo-web-browser';
import { getGoogleIdToken, googleAuthUrl, readGoogleResult } from '@/auth/google';

// Fixed random check and Expo Go address, the browser answer is set per test
jest.mock('expo-crypto', () => ({ randomUUID: () => 'check-1' }));
jest.mock('expo-linking', () => ({ createURL: (path: string) => `exp://10.0.0.5:8081/--/${path}` }));
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }));

const openAuthSession = WebBrowser.openAuthSessionAsync as jest.Mock;
const APP = 'exp://10.0.0.5:8081/--/google';

// Address the redirect page sends back: the app address + what Google put after #
function backFromGoogle(fields: Record<string, string>): string {
	return `${APP}#${new URLSearchParams(fields).toString()}`;
}

const state = (check: string) => JSON.stringify({ check, app: APP });

// Test values, `make` writes the real ones into mobile/.env.local
beforeEach(() => {
	process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
	process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URL = 'https://example.github.io/redirect/';
});

describe('google sign-in address', () => {
	const params = () => new URL(googleAuthUrl('check-1', APP)).searchParams;

	it('asks Google for an id token with the web client and redirect page from the settings', () => {
		expect(params().get('client_id')).toBe('test-client.apps.googleusercontent.com');
		expect(params().get('redirect_uri')).toBe('https://example.github.io/redirect/');
		expect(params().get('response_type')).toBe('id_token');
		expect(params().get('scope')).toBe('openid email profile');
	});

	it('carries the random check and the app address in state', () => {
		expect(JSON.parse(params().get('state')!)).toEqual({ check: 'check-1', app: APP });
		expect(params().get('nonce')).toBe('check-1');
	});
});

describe('reading what Google sent back', () => {
	it('returns the id token when the check matches', () => {
		expect(readGoogleResult(backFromGoogle({ id_token: 'tok', state: state('check-1') }), 'check-1')).toBe('tok');
	});

	it('refuses a token with someone else’s check', () => {
		expect(() => readGoogleResult(backFromGoogle({ id_token: 'tok', state: state('other') }), 'check-1')).toThrow(
			"Google sign-in couldn't be checked",
		);
	});

	it('refuses an answer with no readable state', () => {
		expect(() => readGoogleResult(backFromGoogle({ id_token: 'tok' }), 'check-1')).toThrow("couldn't be checked");
	});

	it('returns nothing when the user said no on Google’s page', () => {
		expect(readGoogleResult(backFromGoogle({ error: 'access_denied', state: state('check-1') }), 'check-1')).toBeNull();
	});

	it('fails on any other Google error', () => {
		expect(() =>
			readGoogleResult(backFromGoogle({ error: 'server_error', state: state('check-1') }), 'check-1'),
		).toThrow("Google didn't sign you in");
	});

	it('fails when the token is missing', () => {
		expect(() => readGoogleResult(backFromGoogle({ state: state('check-1') }), 'check-1')).toThrow(
			"Google didn't send your account",
		);
	});
});

describe('getGoogleIdToken', () => {
	beforeEach(() => openAuthSession.mockReset());

	it('opens Google and waits for the app address', async () => {
		openAuthSession.mockResolvedValue({ type: 'success', url: backFromGoogle({ id_token: 'tok', state: state('check-1') }) });

		await expect(getGoogleIdToken()).resolves.toBe('tok');
		expect(openAuthSession).toHaveBeenCalledWith(googleAuthUrl('check-1', APP), APP);
	});

	it('returns nothing when the user closes the browser', async () => {
		openAuthSession.mockResolvedValue({ type: 'cancel' });

		await expect(getGoogleIdToken()).resolves.toBeNull();
	});

	it('says Google is not set up when make did not copy the settings', async () => {
		delete process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

		await expect(getGoogleIdToken()).rejects.toThrow("Google sign-in isn't set up");
		expect(openAuthSession).not.toHaveBeenCalled();
	});
});
