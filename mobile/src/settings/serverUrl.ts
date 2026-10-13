export type UrlCheck = { ok: true; url: string } | { ok: false; error: string };

const LOCAL_HOST = /^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?(\/|$)/;
const VALID_URL = /^https?:\/\/[a-z0-9.-]+(:\d{1,5})?(\/[^\s]*)?$/i;

// Default address, from mobile/.env or from `make`
export function defaultServerUrl(): string {
	return process.env.EXPO_PUBLIC_API_URL ?? '';
}

// Cleans what the user typed into a usable backend address
export function normalizeServerUrl(input: string): UrlCheck {
	let url = input.trim();
	if (!url) return { ok: false, error: 'Enter the backend address.' };

	// No protocol: http for local machines, https for public links
	if (!/^[a-z]+:\/\//i.test(url)) url = `${LOCAL_HOST.test(url) ? 'http' : 'https'}://${url}`;
	url = url.replace(/\/+$/, '');

	if (!VALID_URL.test(url)) {
		return { ok: false, error: 'This is not a valid address. Example: http://192.168.1.10:8080' };
	}
	return { ok: true, url };
}
