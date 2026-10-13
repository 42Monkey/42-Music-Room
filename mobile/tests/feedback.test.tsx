import { Pressable, Text } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ApiError, NetworkError } from '@/api/errors';
import { describeError } from '@/feedback/describeError';
import { ErrorText } from '@/feedback/ErrorText';
import { FeedbackProvider, useFeedback } from '@/feedback/FeedbackProvider';

describe('describeError', () => {
	it('tells the user to check the address when the server cannot be reached', () => {
		const result = describeError(new NetworkError('unreachable', 'http://10.0.0.5:8080'));

		expect(result.title).toBe("Can't reach the server");
		expect(result.message).toContain('http://10.0.0.5:8080');
		expect(result.action).toBe('settings');
	});

	it('explains a timeout and offers a retry', () => {
		const result = describeError(new NetworkError('timeout', 'http://10.0.0.5:8080'));

		expect(result.title).toBe('The server is not answering');
		expect(result.action).toBe('retry');
	});

	it('asks for an address when none is set', () => {
		const result = describeError(new NetworkError('no-address', ''));

		expect(result.title).toBe('No server address');
		expect(result.action).toBe('settings');
	});

	it('sends the user back to login when the session expired', () => {
		const result = describeError(new ApiError(401, 'Unauthorized'));

		expect(result.title).toBe('Session ended');
		expect(result.action).toBe('login');
	});

	it('shows the server message for a refused action', () => {
		const result = describeError(new ApiError(403, 'This room is invite-only'));

		expect(result.title).toBe('Not allowed');
		expect(result.message).toBe('This room is invite-only.');
	});

	it('turns validation messages into sentences', () => {
		const result = describeError(new ApiError(400, ['email must be an email', 'password is too short']));

		expect(result.title).toBe('Check your input');
		expect(result.message).toBe('Email must be an email.\nPassword is too short.');
	});

	it('asks the user to wait after too many attempts', () => {
		const result = describeError(new ApiError(429, 'ThrottlerException: Too Many Requests'));

		expect(result.title).toBe('Too many attempts');
		expect(result.message).toBe('Wait a minute, then try again.');
	});

	it('blames the music service when Deezer is down', () => {
		const result = describeError(new ApiError(502, 'Could not reach Deezer'));

		expect(result.title).toBe('Music service unavailable');
		expect(result.action).toBe('retry');
	});

	it('hides internal details of a server crash', () => {
		const result = describeError(new ApiError(500, 'Internal server error'));

		expect(result.title).toBe('Server error');
		expect(result.message).toBe('The server hit a problem. Try again in a moment.');
		expect(result.action).toBe('retry');
	});

	it('falls back to a generic message for unknown errors', () => {
		const result = describeError(new Error('boom'));

		expect(result.title).toBe('Something went wrong');
		expect(result.message).toBe('Boom.');
	});
});

type Feedback = ReturnType<typeof useFeedback>;

// Renders a button that runs one feedback call
function Trigger({ run }: { run: (feedback: Feedback) => void }) {
	const feedback = useFeedback();
	return (
		<Pressable onPress={() => run(feedback)}>
			<Text>Trigger</Text>
		</Pressable>
	);
}

async function renderWith(run: (feedback: Feedback) => void) {
	await render(
		<FeedbackProvider>
			<Trigger run={run} />
		</FeedbackProvider>,
	);
	await fireEvent.press(screen.getByText('Trigger'));
}

describe('toast', () => {
	afterEach(() => {
		jest.useRealTimers();
	});

	it('shows the message', async () => {
		await renderWith((f) => f.toast('Server saved', 'success'));

		expect(screen.getByText('Server saved')).toBeTruthy();
	});

	it('disappears after a few seconds', async () => {
		jest.useFakeTimers();
		await renderWith((f) => f.toast('Server saved'));

		await act(() => jest.advanceTimersByTime(5000));

		expect(screen.queryByText('Server saved')).toBeNull();
	});

	it('disappears when tapped', async () => {
		await renderWith((f) => f.toast('Server saved'));

		await fireEvent.press(screen.getByText('Server saved'));

		expect(screen.queryByText('Server saved')).toBeNull();
	});
});

describe('dialog', () => {
	it('shows a title and a message, then runs the main action', async () => {
		const onConfirm = jest.fn();
		await renderWith((f) =>
			f.dialog({ title: 'Session ended', message: 'Log in again.', primary: { label: 'OK', onPress: onConfirm } }),
		);

		expect(screen.getByText('Session ended')).toBeTruthy();
		expect(screen.getByText('Log in again.')).toBeTruthy();
		await fireEvent.press(screen.getByText('OK'));

		expect(onConfirm).toHaveBeenCalled();
		expect(screen.queryByText('Session ended')).toBeNull();
	});

	it('closes with the second button', async () => {
		await renderWith((f) =>
			f.dialog({ title: 'Leave room?', message: 'You can come back.', primary: { label: 'Leave' }, secondary: { label: 'Stay' } }),
		);

		await fireEvent.press(screen.getByText('Stay'));

		expect(screen.queryByText('Leave room?')).toBeNull();
	});
});

describe('showError', () => {
	beforeEach(() => {
		(router.push as jest.Mock).mockReset();
	});

	it('offers to open settings when the server is unreachable', async () => {
		await renderWith((f) => f.showError(new NetworkError('unreachable', 'http://10.0.0.5:8080')));

		expect(screen.getByText("Can't reach the server")).toBeTruthy();
		await fireEvent.press(screen.getByText('Open settings'));

		expect(router.push).toHaveBeenCalledWith('/settings');
	});

	it('offers a retry when one is possible', async () => {
		const onRetry = jest.fn();
		await renderWith((f) => f.showError(new ApiError(500, 'Internal server error'), { onRetry }));

		await fireEvent.press(screen.getByText('Try again'));

		expect(onRetry).toHaveBeenCalled();
	});

	it('can show a short error as a toast', async () => {
		await renderWith((f) => f.showError(new ApiError(409, 'You have already voted for this track'), { as: 'toast' }));

		expect(screen.getByText('You have already voted for this track.')).toBeTruthy();
	});
});

describe('ErrorText', () => {
	it('shows the explanation of an error as an alert', async () => {
		await render(<ErrorText error={new ApiError(403, 'This room is invite-only')} />);

		expect(screen.getByRole('alert')).toBeTruthy();
		expect(screen.getByText('This room is invite-only.')).toBeTruthy();
	});

	it('shows nothing without an error', async () => {
		await render(<ErrorText error={null} />);

		expect(screen.queryByRole('alert')).toBeNull();
	});
});
