import { ApiError, NetworkError } from '@/api/errors';

export type ErrorAction = 'settings' | 'login' | 'retry';

export type ErrorDescription = {
	title: string;
	message: string;
	action?: ErrorAction;
};

// "email must be an email" -> "Email must be an email."
function toSentence(text: string): string {
	const trimmed = text.trim();
	if (!trimmed) return '';
	const capitalized = trimmed[0].toUpperCase() + trimmed.slice(1);
	return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
}

function serverText(error: ApiError, fallback: string): string {
	const { serverMessage } = error;
	if (Array.isArray(serverMessage)) return serverMessage.map(toSentence).join('\n');
	return serverMessage ? toSentence(serverMessage) : fallback;
}

// Network failures: the backend never answered
function describeNetwork(error: NetworkError): ErrorDescription {
	switch (error.reason) {
		case 'no-address':
			return {
				title: 'No server address',
				message: 'Set the backend address in Settings to continue.',
				action: 'settings',
			};
		case 'timeout':
			return {
				title: 'The server is not answering',
				message: `${error.address} took too long to answer. Check that the backend is running, then try again.`,
				action: 'retry',
			};
		default:
			return {
				title: "Can't reach the server",
				message: `Nothing answered at ${error.address}. Check the address in Settings and that the backend is running.`,
				action: 'settings',
			};
	}
}

// Backend answers: one message per status code
function describeApi(error: ApiError): ErrorDescription {
	const { status } = error;
	if (status === 400) return { title: 'Check your input', message: serverText(error, 'Some fields are not valid.') };
	if (status === 401) {
		return { title: 'Session ended', message: 'Your session expired. Log in again to continue.', action: 'login' };
	}
	if (status === 403) return { title: 'Not allowed', message: serverText(error, "You don't have access to this.") };
	if (status === 404) return { title: 'Not found', message: serverText(error, 'This no longer exists.') };
	if (status === 409) return { title: 'Already done', message: serverText(error, 'This was already done.') };
	if (status === 429) return { title: 'Too many attempts', message: 'Wait a minute, then try again.' };
	if (status === 502) {
		return {
			title: 'Music service unavailable',
			message: "Deezer isn't answering right now. Try again in a moment.",
			action: 'retry',
		};
	}
	if (status >= 500) {
		return { title: 'Server error', message: 'The server hit a problem. Try again in a moment.', action: 'retry' };
	}
	return { title: 'Request refused', message: serverText(error, `The server answered with error ${status}.`) };
}

// Turns any error into a title, a message and what to do next
export function describeError(error: unknown): ErrorDescription {
	if (error instanceof NetworkError) return describeNetwork(error);
	if (error instanceof ApiError) return describeApi(error);
	const text = error instanceof Error ? error.message : String(error);
	return { title: 'Something went wrong', message: toSentence(text) || 'Try again in a moment.' };
}
