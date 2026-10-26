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
jest.mock('expo-router', () => {
	const { useEffect } = require('react');
	return {
		router: {
			push: jest.fn(),
			back: jest.fn(),
			replace: jest.fn(),
			dismiss: jest.fn(),
			dismissTo: jest.fn(),
			canGoBack: jest.fn(() => true),
		},
		useLocalSearchParams: jest.fn(() => ({})),
		useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
	};
});

// Phone position, granted by default
jest.mock('expo-location', () => ({
	Accuracy: { Balanced: 3 },
	requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
	getCurrentPositionAsync: jest.fn(async () => ({ coords: { latitude: 13.7563, longitude: 100.5018 } })),
}));

// Native time picker replaced by a button that picks 21:30
jest.mock('@react-native-community/datetimepicker', () => {
	const { createElement } = require('react');
	const { Pressable, Text } = require('react-native');
	return function DateTimePicker(props: { accessibilityLabel?: string; onChange?: (event: unknown, date: Date) => void }) {
		return createElement(
			Pressable,
			{
				testID: 'time-picker',
				accessibilityLabel: props.accessibilityLabel,
				onPress: () => props.onChange?.({ type: 'set' }, new Date(2026, 9, 14, 21, 30)),
			},
			createElement(Text, null, 'picker'),
		);
	};
});

// Audio player stand-in: records play, pause, load and seek
jest.mock('expo-audio', () => {
	const player = { play: jest.fn(), pause: jest.fn(), replace: jest.fn(), seekTo: jest.fn(async () => {}), remove: jest.fn() };
	return {
		useAudioPlayer: () => player,
		useAudioPlayerStatus: () => ({ isLoaded: false, playing: false, currentTime: 0, duration: 0, didJustFinish: false }),
		setAudioModeAsync: jest.fn(async () => {}),
		testPlayer: player,
	};
});

// Gestures: the library's own stand-ins
require('react-native-gesture-handler/jestSetup');

// Animations run instantly in tests (Reanimated and its worklets engine)
jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => ({
	...require('react-native-reanimated/mock'),
	useReducedMotion: () => false,
}));

// Fixed screen insets for tests
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
