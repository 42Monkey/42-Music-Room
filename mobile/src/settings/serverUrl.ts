export type UrlCheck = { ok: true; url: string } | { ok: false; error: string };

const PRIVATE_HOST = /^(localhost|127(\.\d{1,3}){3}|10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2})$/;
const VALID_URL = /^https?:\/\/[a-z0-9.-]+(:\d{1,5})?(\/[^\s]*)?$/i;

// Default address, from mobile/.env or from `make`
export function defaultServerUrl(): string {
	return process.env.EXPO_PUBLIC_API_URL ?? '';
}

function hostOf(url: string): string {
	return url.replace(/^[a-z]+:\/\//i, '').split(/[/:]/)[0].toLowerCase();
}

// Cleans what the user typed into a usable backend address
export function normalizeServerUrl(input: string): UrlCheck {
	let url = input.trim();
	if (!url) return { ok: false, error: 'Enter the backend address.' };

	// No protocol: http on the local network, https for public links
	if (!/^[a-z]+:\/\//i.test(url)) url = `${PRIVATE_HOST.test(hostOf(url)) ? 'http' : 'https'}://${url}`;
	url = url.replace(/\/+$/, '');

	if (!VALID_URL.test(url)) {
		return { ok: false, error: 'This is not a valid address. Example: http://192.168.1.10:8080' };
	}
	// Plain http would send the login in clear text over the internet
	if (/^http:/i.test(url) && !PRIVATE_HOST.test(hostOf(url))) {
		return {
			ok: false,
			error: 'Use https:// for addresses outside your local network, so your login is not sent in clear text.',
		};
	}
	return { ok: true, url };
}
