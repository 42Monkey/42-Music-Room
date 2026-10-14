import * as SecureStore from 'expo-secure-store';

const KEY = 'login';

export type SavedLogin = {
	token: string;
	serverUrl: string;
};

// Login token and the server that issued it, in the phone's encrypted storage
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
	set: (token: string, serverUrl: string) => SecureStore.setItemAsync(KEY, JSON.stringify({ token, serverUrl })),
	clear: () => SecureStore.deleteItemAsync(KEY),
};
