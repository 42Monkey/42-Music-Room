import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

// Both come from backend/.env, `make` copies them into mobile/.env.local (git-ignored).
// clientId: web client of the app's Google Cloud project, the backend only accepts tokens made for it.
// redirectUrl: page on GitHub Pages (source in google-redirect/index.html), Google only sends back
// to fixed https addresses and the tunnel address changes at every `make`
export function googleConfig() {
	return {
		clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '',
		redirectUrl: process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URL ?? '',
	};
}

// Google sign-in page. `state` carries the random check and where the redirect page sends the user back
export function googleAuthUrl(check: string, returnUrl: string): string {
	const { clientId, redirectUrl } = googleConfig();
	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: redirectUrl,
		response_type: 'id_token',
		scope: 'openid email profile',
		nonce: check,
		state: JSON.stringify({ check, app: returnUrl }),
		prompt: 'select_account',
	});
	return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// Takes the id token out of the address the redirect page sent back.
// The check must match the one sent, so another site can't slip its own token into the app.
// null when the user said no on Google's page, same as closing the browser
export function readGoogleResult(url: string, check: string): string | null {
	const params = new URLSearchParams(url.split('#')[1] ?? '');

	if (params.get('error') === 'access_denied') return null;
	if (params.get('error')) throw new Error("Google didn't sign you in. Try again.");

	let state: { check?: unknown } | null = null;
	try {
		state = JSON.parse(params.get('state') ?? '');
	} catch {
		state = null;
	}
	if (state?.check !== check) throw new Error("Google sign-in couldn't be checked. Try again.");

	const idToken = params.get('id_token');
	if (!idToken) throw new Error("Google didn't send your account. Try again.");
	return idToken;
}

// Opens Google in the browser and waits for the redirect page to send the user back.
// null when the user closes the browser
export async function getGoogleIdToken(): Promise<string | null> {
	const { clientId, redirectUrl } = googleConfig();
	if (!clientId || !redirectUrl) {
		throw new Error("Google sign-in isn't set up. Add the Google settings to backend/.env and run make again.");
	}
	const check = Crypto.randomUUID();
	const returnUrl = Linking.createURL('google');
	const result = await WebBrowser.openAuthSessionAsync(googleAuthUrl(check, returnUrl), returnUrl);
	if (result.type !== 'success') return null;
	return readGoogleResult(result.url, check);
}
