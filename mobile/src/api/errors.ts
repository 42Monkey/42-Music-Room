// Error answered by the backend (4xx / 5xx)
export class ApiError extends Error {
	constructor(
		public readonly status: number,
		public readonly serverMessage: string | string[] | null,
	) {
		super(Array.isArray(serverMessage) ? serverMessage.join(', ') : (serverMessage ?? `HTTP ${status}`));
		this.name = 'ApiError';
	}
}

export type NetworkReason = 'unreachable' | 'timeout' | 'no-address';

// The backend never answered
export class NetworkError extends Error {
	constructor(
		public readonly reason: NetworkReason,
		public readonly address: string,
	) {
		super(`Network error (${reason}) for ${address || 'no address'}`);
		this.name = 'NetworkError';
	}
}
