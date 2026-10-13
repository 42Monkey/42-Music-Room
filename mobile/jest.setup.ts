// In-memory phone storage for tests
jest.mock('@react-native-async-storage/async-storage', () =>
	require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// In-memory encrypted storage for tests
jest.mock('expo-secure-store', () => {
	const store = new Map<string, string>();
	return {
		getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
		setItemAsync: jest.fn(async (key: string, value: string) => {
			store.set(key, value);
		}),
		deleteItemAsync: jest.fn(async (key: string) => {
			store.delete(key);
		}),
	};
});

// Navigation calls are recorded, not performed
jest.mock('expo-router', () => ({
	router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));

// Fixed screen insets for tests
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
