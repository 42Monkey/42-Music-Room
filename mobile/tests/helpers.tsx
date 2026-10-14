import type { ReactElement } from 'react';
import { render } from '@testing-library/react-native';
import { FeedbackProvider } from '@/feedback/FeedbackProvider';
import { SessionProvider } from '@/session/SessionProvider';
import { SettingsProvider } from '@/settings/SettingsProvider';

// Default backend address used by the tests
export const SERVER = 'http://192.168.1.10:8080';

// Minimal stand-in for a fetch Response
export function reply(status: number, body?: unknown) {
	return {
		ok: status >= 200 && status < 300,
		status,
		text: async () => (body === undefined ? '' : JSON.stringify(body)),
	};
}

// Error of a call that must fail
export function failure(promise: Promise<unknown>): Promise<any> {
	return promise.then(
		() => {
			throw new Error('Expected the call to fail');
		},
		(error) => error,
	);
}

// Replaces the network for one test file
export function mockFetch() {
	const fetchMock = jest.fn();
	global.fetch = fetchMock as unknown as typeof fetch;
	return fetchMock;
}

// Same providers as the app, around one screen
export function renderWithProviders(screen: ReactElement) {
	return render(
		<SettingsProvider>
			<FeedbackProvider>
				<SessionProvider>{screen}</SessionProvider>
			</FeedbackProvider>
		</SettingsProvider>,
	);
}

type Handler = (...args: any[]) => void;

// Socket.io stand-in: records what the app sends, lets tests play the server
export class FakeSocket {
	connected = false;
	sent: { event: string; payload: unknown }[] = [];
	private handlers = new Map<string, Set<Handler>>();

	on(event: string, handler: Handler) {
		if (!this.handlers.has(event)) this.handlers.set(event, new Set());
		this.handlers.get(event)!.add(handler);
		return this;
	}

	off(event: string, handler?: Handler) {
		if (handler) this.handlers.get(event)?.delete(handler);
		else this.handlers.delete(event);
		return this;
	}

	emit(event: string, payload?: unknown) {
		this.sent.push({ event, payload });
		return this;
	}

	disconnect = jest.fn(() => {
		this.connected = false;
		return this;
	});

	// Plays an event coming from the server
	serverSends(event: string, ...args: unknown[]) {
		if (event === 'connect') this.connected = true;
		if (event === 'disconnect') this.connected = false;
		this.handlers.get(event)?.forEach((handler) => handler(...args));
	}

	listenerCount(event: string) {
		return this.handlers.get(event)?.size ?? 0;
	}
}
