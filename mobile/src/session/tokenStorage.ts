import * as SecureStore from 'expo-secure-store';

const KEY = 'login';

export type SavedLogin = {
	token: string;
	// 7-day key to get a new token once it expires
	refreshToken?: string;
	serverUrl: string;
};

// Login tokens and the server that issued them, in the phone's encrypted storage
export const tokenStorage = {
	async get(): Promise<SavedLogin | null> {
		const raw = await SecureStore.getItemAsync(KEY);
		if (!raw) return null;
		try {
			const saved = JSON.parse(raw);
			return typeof saved?.token === 'string' && typeof saved?.serverUrl === 'string' ? saved : null;
		} catch {
			return null;
		}
	},
	set: (token: string, serverUrl: string, refreshToken?: string) =>
		SecureStore.setItemAsync(KEY, JSON.stringify({ token, refreshToken, serverUrl })),
	clear: () => SecureStore.deleteItemAsync(KEY),
};
