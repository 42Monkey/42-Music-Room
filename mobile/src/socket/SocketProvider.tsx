import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { deviceHeaders } from '@/lib/deviceHeaders';
import { useSession } from '@/session/SessionProvider';
import { useSettings } from '@/settings/SettingsProvider';

type Live = {
	socket: Socket | null;
	connected: boolean;
};

export const SocketContext = createContext<Live>({ socket: null, connected: false });

// One live connection to the backend while logged in
export function SocketProvider({ children }: { children: ReactNode }) {
	const { serverUrl } = useSettings();
	const { token } = useSession();
	const [socket, setSocket] = useState<Socket | null>(null);
	const [connected, setConnected] = useState(false);

	useEffect(() => {
		if (!token || !serverUrl) return;

		// Websocket only: no long-polling through nginx
		const next = io(serverUrl, {
			auth: { token },
			extraHeaders: deviceHeaders(),
			transports: ['websocket'],
		});
		const onConnect = () => setConnected(true);
		const onDisconnect = () => setConnected(false);
		next.on('connect', onConnect);
		next.on('disconnect', onDisconnect);
		setSocket(next);

		// Closed on logout or address change
		return () => {
			next.off('connect', onConnect);
			next.off('disconnect', onDisconnect);
			next.disconnect();
			setSocket(null);
			setConnected(false);
		};
	}, [token, serverUrl]);

	return <SocketContext.Provider value={{ socket, connected }}>{children}</SocketContext.Provider>;
}

export function useSocket(): Live {
	return useContext(SocketContext);
}
