import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

// Platform, device and app version for the backend logs (V.6)
export function deviceHeaders(): Record<string, string> {
	return {
		'x-platform': Platform.OS,
		'x-device': Device.modelName ?? 'Unknown device',
		'x-app-version': Constants.expoConfig?.version ?? 'unknown',
	};
}
