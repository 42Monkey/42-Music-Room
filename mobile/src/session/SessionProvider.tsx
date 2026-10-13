import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, configureApi } from '@/api/client';
import { ApiError } from '@/api/errors';
import { useSettings } from '@/settings/SettingsProvider';
import type { Tokens, User } from '@/types/api';
import { tokenStorage } from './tokenStorage';

type Status = 'loading' | 'signedOut' | 'signedIn';

type Session = {
	status: Status;
	user: User | null;
	token: string | null;
	restoreError: unknown;
	expired: boolean;
	signIn: (tokens: Tokens) => Promise<void>;
	signOut: () => Promise<void>;
	retryRestore: () => Promise<void>;
	dismissExpired: () => void;
};

const SessionContext = createContext<Session | null>(null);

// Who is logged in, shared by every screen
export function SessionProvider({ children }: { children: ReactNode }) {
	const { ready, serverUrl } = useSettings();
	const [status, setStatus] = useState<Status>('loading');
	const [user, setUser] = useState<User | null>(null);
	const [token, setToken] = useState<string | null>(null);
	const [restoreError, setRestoreError] = useState<unknown>(null);
	const [expired, setExpired] = useState(false);
	const statusRef = useRef(status);
	statusRef.current = status;

	const endSession = useCallback(async (sessionExpired: boolean) => {
		await tokenStorage.clear();
		configureApi({ token: null });
		setUser(null);
		setToken(null);
		setExpired(sessionExpired);
		setStatus('signedOut');
	}, []);

	// Checks the saved token against the server (screens stay put meanwhile)
	const restore = useCallback(async () => {
		setRestoreError(null);
		const saved = await tokenStorage.get();
		if (!saved) {
			setStatus('signedOut');
			return;
		}
		configureApi({ token: saved });
		try {
			setUser(await api.get<User>('/users/me'));
			setToken(saved);
			setStatus('signedIn');
		} catch (error) {
			configureApi({ token: null });
			// Refused token is forgotten, unreachable server keeps it for a retry
			if (error instanceof ApiError && error.status === 401) await tokenStorage.clear();
			else setRestoreError(error);
			setStatus('signedOut');
		}
	}, []);

	// Again when the server address changes
	useEffect(() => {
		if (ready) restore();
	}, [ready, serverUrl, restore]);

	// Token refused in the middle of a session
	useEffect(() => {
		configureApi({
			onUnauthorized: () => {
				if (statusRef.current === 'signedIn') endSession(true);
			},
		});
	}, [endSession]);

	// Called by the login screens with the backend's tokens
	const signIn = useCallback(async (tokens: Tokens) => {
		configureApi({ token: tokens.accessToken });
		let me: User;
		try {
			me = await api.get<User>('/users/me');
		} catch (error) {
			configureApi({ token: null });
			throw error;
		}
		await tokenStorage.set(tokens.accessToken);
		setUser(me);
		setToken(tokens.accessToken);
		setExpired(false);
		setRestoreError(null);
		setStatus('signedIn');
	}, []);

	const signOut = useCallback(() => endSession(false), [endSession]);
	const dismissExpired = useCallback(() => setExpired(false), []);

	const value = useMemo(
		() => ({
			status,
			user,
			token,
			restoreError,
			expired,
			signIn,
			signOut,
			retryRestore: restore,
			dismissExpired,
		}),
		[status, user, token, restoreError, expired, signIn, signOut, restore, dismissExpired],
	);

	return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
	const session = useContext(SessionContext);
	if (!session) throw new Error('useSession must be used inside SessionProvider');
	return session;
}
