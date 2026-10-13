import { deviceHeaders } from '@/lib/deviceHeaders';
import { ApiError, NetworkError } from './errors';

type ApiConfig = {
	baseUrl: string;
	token: string | null;
	onUnauthorized: () => void;
	timeoutMs: number;
};

let config: ApiConfig = {
	baseUrl: '',
	token: null,
	onUnauthorized: () => {},
	timeoutMs: 10000,
};

// Called by the settings and session providers
export function configureApi(changes: Partial<ApiConfig>) {
	config = { ...config, ...changes };
}

function readServerMessage(text: string): string | string[] | null {
	try {
		const body = JSON.parse(text);
		return body?.message ?? null;
	} catch {
		return text || null;
	}
}

// One HTTP call to the backend, with token, log headers and timeout
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
	const baseUrl = config.baseUrl.replace(/\/+$/, '');
	if (!baseUrl) throw new NetworkError('no-address', '');

	const token = config.token;
	const headers: Record<string, string> = { ...deviceHeaders() };
	if (token) headers.Authorization = `Bearer ${token}`;
	if (body !== undefined) headers['Content-Type'] = 'application/json';

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), config.timeoutMs);

	let response: Awaited<ReturnType<typeof fetch>>;
	try {
		response = await fetch(`${baseUrl}${path}`, {
			method,
			headers,
			body: body === undefined ? undefined : JSON.stringify(body),
			signal: controller.signal,
		});
	} catch {
		throw new NetworkError(controller.signal.aborted ? 'timeout' : 'unreachable', baseUrl);
	} finally {
		clearTimeout(timer);
	}

	const text = await response.text();
	if (!response.ok) {
		// Token refused: the session is over
		if (response.status === 401 && token) config.onUnauthorized();
		throw new ApiError(response.status, readServerMessage(text));
	}
	return (text ? JSON.parse(text) : null) as T;
}

export const api = {
	get: <T>(path: string) => request<T>('GET', path),
	post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
	patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
	delete: <T>(path: string) => request<T>('DELETE', path),
};
