import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { configureApi } from '@/api/client';
import { defaultServerUrl } from './serverUrl';

const STORAGE_KEY = 'serverUrl';

type Settings = {
	ready: boolean;
	serverUrl: string;
	defaultUrl: string;
	isCustom: boolean;
	saveServerUrl: (url: string) => Promise<void>;
	resetServerUrl: () => Promise<void>;
};

const SettingsContext = createContext<Settings | null>(null);

// Backend address chosen in the app (V.5), saved on the phone
export function SettingsProvider({ children }: { children: ReactNode }) {
	const defaultUrl = defaultServerUrl();
	const [customUrl, setCustomUrl] = useState<string | null>(null);
	const [ready, setReady] = useState(false);
	const serverUrl = customUrl ?? defaultUrl;

	// Every API call goes to the current address (set before child screens run)
	configureApi({ baseUrl: serverUrl });

	// Load the saved address once
	useEffect(() => {
		AsyncStorage.getItem(STORAGE_KEY)
			.then(setCustomUrl)
			.catch(() => setCustomUrl(null))
			.finally(() => setReady(true));
	}, []);

	// The API switches at once, no wait for the next render
	const saveServerUrl = useCallback(async (url: string) => {
		await AsyncStorage.setItem(STORAGE_KEY, url);
		configureApi({ baseUrl: url });
		setCustomUrl(url);
	}, []);

	const resetServerUrl = useCallback(async () => {
		await AsyncStorage.removeItem(STORAGE_KEY);
		configureApi({ baseUrl: defaultUrl });
		setCustomUrl(null);
	}, [defaultUrl]);

	const value = useMemo(
		() => ({ ready, serverUrl, defaultUrl, isCustom: customUrl !== null, saveServerUrl, resetServerUrl }),
		[ready, serverUrl, defaultUrl, customUrl, saveServerUrl, resetServerUrl],
	);

	return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Settings {
	const settings = useContext(SettingsContext);
	if (!settings) throw new Error('useSettings must be used inside SettingsProvider');
	return settings;
}
