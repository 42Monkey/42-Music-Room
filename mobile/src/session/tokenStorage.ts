import * as SecureStore from 'expo-secure-store';

const KEY = 'accessToken';

// Login token in the phone's encrypted storage
export const tokenStorage = {
	get: () => SecureStore.getItemAsync(KEY),
	set: (token: string) => SecureStore.setItemAsync(KEY, token),
	clear: () => SecureStore.deleteItemAsync(KEY),
};
