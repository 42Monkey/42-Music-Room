import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, configureApi, currentToken } from '@/api/client';
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
	refreshUser: () => Promise<void>;
	updateUser: (user: User) => void;
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
		// A token only goes back to the server that issued it
		if (saved.serverUrl !== serverUrl) {
			await endSession(false);
			return;
		}
		configureApi({ token: saved.token });
		try {
			setUser(await api.get<User>('/users/me'));
			// The saved token may have been renewed on the way
			setToken(currentToken());
			setStatus('signedIn');
		} catch (error) {
			configureApi({ token: null });
			// Refused token is forgotten, unreachable server keeps it for a retry
			if (error instanceof ApiError && error.status === 401) await tokenStorage.clear();
			else setRestoreError(error);
			setStatus('signedOut');
		}
	}, [serverUrl, endSession]);

	// Again when the server address changes
	useEffect(() => {
		if (ready) restore();
	}, [ready, serverUrl, restore]);

	// Expired login: one renewal at a time, shared by every call that hit it
	const renewing = useRef<Promise<string | null> | null>(null);
	const renew = useCallback(() => {
		renewing.current ??= (async () => {
			const saved = await tokenStorage.get();
			if (!saved?.refreshToken || saved.serverUrl !== serverUrl) return null;
			try {
				const tokens = await api.post<Tokens>('/auth/refresh', { refreshToken: saved.refreshToken });
				await tokenStorage.set(tokens.accessToken, serverUrl, tokens.refreshToken);
				configureApi({ token: tokens.accessToken });
				setToken(tokens.accessToken);
				return tokens.accessToken;
			} catch {
				return null;
			}
		})().finally(() => {
			renewing.current = null;
		});
		return renewing.current;
	}, [serverUrl]);

	// Login refused in the middle of a session, even after a renewal
	useEffect(() => {
		configureApi({
			renew,
			onUnauthorized: () => {
				if (statusRef.current === 'signedIn') endSession(true);
			},
		});
	}, [endSession, renew]);

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
		await tokenStorage.set(tokens.accessToken, serverUrl, tokens.refreshToken);
		setUser(me);
		setToken(tokens.accessToken);
		setExpired(false);
		setRestoreError(null);
		setStatus('signedIn');
	}, [serverUrl]);

	const signOut = useCallback(() => endSession(false), [endSession]);
	const refreshUser = useCallback(async () => {
		setUser(await api.get<User>('/users/me'));
	}, []);
	const updateUser = useCallback((changed: User) => setUser(changed), []);
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
			refreshUser,
			updateUser,
			retryRestore: restore,
			dismissExpired,
		}),
		[status, user, token, restoreError, expired, signIn, signOut, refreshUser, updateUser, restore, dismissExpired],
	);

	return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
	const session = useContext(SessionContext);
	if (!session) throw new Error('useSession must be used inside SessionProvider');
	return session;
}
