import type { ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { io } from 'socket.io-client';
import { configureApi } from '@/api/client';
import { ApiError } from '@/api/errors';
import { FeedbackProvider } from '@/feedback/FeedbackProvider';
import { SessionProvider, useSession } from '@/session/SessionProvider';
import { tokenStorage } from '@/session/tokenStorage';
import { SettingsProvider } from '@/settings/SettingsProvider';
import { ConnectionWatcher } from '@/socket/ConnectionWatcher';
import { SocketContext, SocketProvider, useSocket } from '@/socket/SocketProvider';
import { useRoomTracks } from '@/socket/useRoomTracks';
import { FakeSocket, mockFetch, reply, SERVER } from './helpers';

jest.mock('socket.io-client', () => ({ io: jest.fn() }));

const ioMock = io as unknown as jest.Mock;
let socket: FakeSocket;
let fetchMock: jest.Mock;

beforeEach(async () => {
	await AsyncStorage.clear();
	await tokenStorage.clear();
	process.env.EXPO_PUBLIC_API_URL = 'http://192.168.1.10:8080';
	socket = new FakeSocket();
	ioMock.mockReset();
	ioMock.mockReturnValue(socket);
	fetchMock = mockFetch();
});

describe('SocketProvider', () => {
	function wrapper({ children }: { children: ReactNode }) {
		return (
			<SettingsProvider>
				<SessionProvider>
					<SocketProvider>{children}</SocketProvider>
				</SessionProvider>
			</SettingsProvider>
		);
	}

	async function renderSocket() {
		const view = await renderHook(() => ({ live: useSocket(), session: useSession() }), { wrapper });
		await waitFor(() => expect(view.result.current.session.status).not.toBe('loading'));
		return view;
	}

	beforeEach(() => {
		fetchMock.mockResolvedValue(reply(200, { id: 'u1', displayName: 'Test User 1' }));
	});

	it('does not connect while logged out', async () => {
		await renderSocket();

		expect(ioMock).not.toHaveBeenCalled();
	});

	it('connects to the server with the session token once logged in', async () => {
		await tokenStorage.set('saved-token', SERVER);

		await renderSocket();

		await waitFor(() => expect(ioMock).toHaveBeenCalledTimes(1));
		const [url, options] = ioMock.mock.calls[0];
		expect(url).toBe('http://192.168.1.10:8080');
		expect(options.auth).toEqual({ token: 'saved-token' });
		expect(options.transports).toEqual(['websocket']);
		expect(options.extraHeaders['x-platform']).toBe('ios');
	});

	it('reports when the connection is up or down', async () => {
		await tokenStorage.set('saved-token', SERVER);
		const { result } = await renderSocket();
		await waitFor(() => expect(ioMock).toHaveBeenCalled());

		await act(() => socket.serverSends('connect'));
		expect(result.current.live.connected).toBe(true);

		await act(() => socket.serverSends('disconnect'));
		expect(result.current.live.connected).toBe(false);
	});

	it('closes the connection on sign out', async () => {
		await tokenStorage.set('saved-token', SERVER);
		const { result } = await renderSocket();
		await waitFor(() => expect(ioMock).toHaveBeenCalled());

		await act(() => result.current.session.signOut());

		expect(socket.disconnect).toHaveBeenCalled();
		expect(result.current.live.socket).toBeNull();
	});
});

describe('useRoomTracks', () => {
	const TRACKS = [{ id: 't1', title: 'One More Time', score: 2 }];
	const UPDATED = [
		{ id: 't2', title: 'Harder, Better', score: 3 },
		{ id: 't1', title: 'One More Time', score: 2 },
	];

	function wrapper({ children }: { children: ReactNode }) {
		return (
			<SocketContext.Provider value={{ socket: socket as never, connected: socket.connected }}>
				{children}
			</SocketContext.Provider>
		);
	}

	async function renderTracks() {
		const view = await renderHook(() => useRoomTracks('room-1'), { wrapper });
		await waitFor(() => expect(view.result.current.loading).toBe(false));
		return view;
	}

	beforeEach(() => {
		socket.connected = true;
		fetchMock.mockResolvedValue(reply(200, TRACKS));
		configureApi({ baseUrl: 'http://192.168.1.10:8080', token: 'token' });
	});

	it('loads the track list of the room', async () => {
		const { result } = await renderTracks();

		expect(fetchMock.mock.calls[0][0]).toBe('http://192.168.1.10:8080/rooms/room-1/tracks');
		expect(result.current.tracks).toEqual(TRACKS);
	});

	it('joins the room for live updates', async () => {
		await renderTracks();

		expect(socket.sent).toContainEqual({ event: 'joinRoom', payload: { roomId: 'room-1' } });
	});

	it('replaces the list when the server pushes an update', async () => {
		const { result } = await renderTracks();

		await act(() => socket.serverSends('tracks:updated', UPDATED));

		expect(result.current.tracks).toEqual(UPDATED);
	});

	it('leaves the room when the screen closes', async () => {
		const { unmount } = await renderTracks();

		await act(() => unmount());

		expect(socket.sent).toContainEqual({ event: 'leaveRoom', payload: { roomId: 'room-1' } });
		expect(socket.listenerCount('tracks:updated')).toBe(0);
	});

	it('rejoins and reloads after the connection comes back', async () => {
		await renderTracks();
		socket.sent = [];
		fetchMock.mockClear();

		await act(() => socket.serverSends('connect'));

		expect(socket.sent).toContainEqual({ event: 'joinRoom', payload: { roomId: 'room-1' } });
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
	});

	it('waits until the room is ready before loading', async () => {
		const view = await renderHook(() => useRoomTracks('room-1', { enabled: false }), { wrapper });

		expect(fetchMock).not.toHaveBeenCalled();
		expect(socket.sent).toEqual([]);
		expect(view.result.current.loading).toBe(true);
	});

	it('sends the phone position when the room needs it', async () => {
		const view = await renderHook(() => useRoomTracks('room-1', { position: { lat: 13.75, lng: 100.5 } }), { wrapper });
		await waitFor(() => expect(view.result.current.loading).toBe(false));

		expect(fetchMock.mock.calls[0][0]).toBe('http://192.168.1.10:8080/rooms/room-1/tracks?lat=13.75&lng=100.5');
	});

	it('reports why the list could not load', async () => {
		fetchMock.mockResolvedValue(reply(403, { statusCode: 403, message: 'This room is invite-only' }));

		const { result } = await renderTracks();

		expect(result.current.error).toBeInstanceOf(ApiError);
		expect(result.current.tracks).toEqual([]);
	});
});

describe('ConnectionWatcher', () => {
	// Renders the watcher with a given connection state
	function Live({ connected }: { connected: boolean }) {
		return (
			<FeedbackProvider>
				<SocketContext.Provider value={{ socket: {} as never, connected }}>
					<ConnectionWatcher />
				</SocketContext.Provider>
			</FeedbackProvider>
		);
	}

	it('stays quiet on the first connection', async () => {
		const view = await render(<Live connected={false} />);

		await act(() => view.rerender(<Live connected />));

		expect(screen.queryByText(/Live updates/)).toBeNull();
	});

	it('warns when live updates drop, then when they come back', async () => {
		const view = await render(<Live connected />);

		await act(() => view.rerender(<Live connected={false} />));
		expect(screen.getByText('Live updates paused. Reconnecting…')).toBeTruthy();

		await act(() => view.rerender(<Live connected />));
		expect(screen.getByText('Live updates are back.')).toBeTruthy();
	});
});
