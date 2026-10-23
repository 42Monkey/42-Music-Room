import { Linking, Pressable, Text } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ApiError, NetworkError } from '@/api/errors';
import { describeError } from '@/feedback/describeError';
import { ErrorText } from '@/feedback/ErrorText';
import { LocationError } from '@/lib/location';
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

	it('says the email or password is wrong, not that the session ended', () => {
		const result = describeError(new ApiError(401, 'Invalid credentials'));

		expect(result.title).toBe('Wrong email or password');
		expect(result.message).toBe('Check your email and password, then try again.');
		expect(result.action).toBeUndefined();
	});

	it('says the email already has an account and how to get in', () => {
		const result = describeError(new ApiError(409, 'Email already in use'));

		expect(result.title).toBe('Email already registered');
		expect(result.message).toContain('Log in instead');
	});

	it('says a wrong or dead code can be replaced by a new one', () => {
		const result = describeError(new ApiError(400, 'Invalid or expired verification code'));

		expect(result.title).toBe("That code didn't work");
		expect(result.message).toContain('send a new one');
	});

	it('shows the server message for a refused action', () => {
		const result = describeError(new ApiError(403, 'Only the owner can manage members'));

		expect(result.title).toBe('Not allowed');
		expect(result.message).toBe('Only the owner can manage members.');
	});

	it('explains that a room is for invited people only', () => {
		const result = describeError(new ApiError(403, 'This room is invite-only'));

		expect(result.title).toBe('Invite only');
		expect(result.message).toBe('Only invited people can take part in this room. Ask the owner for an invite.');
	});

	it('explains that a room is closed outside its time window', () => {
		const result = describeError(new ApiError(403, 'This room is outside its active time window'));

		expect(result.title).toBe('Closed right now');
		expect(result.message).toBe('This room only accepts people during its time window. Come back then.');
	});

	it('explains that the user is too far from the room', () => {
		const result = describeError(new ApiError(403, "You are outside this room's allowed location radius"));

		expect(result.title).toBe('Too far away');
		expect(result.message).toBe("You need to be at the room's place to take part.");
	});

	it('asks for the location when a room needs it', () => {
		const result = describeError(new ApiError(400, 'This room requires lat/lng query params to verify your location'));

		expect(result.title).toBe('Location needed');
		expect(result.message).toBe('This room only accepts people at its place. Allow location access, then try again.');
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

	it('sends the user to the phone settings when location access is off', () => {
		const result = describeError(new LocationError('denied'));

		expect(result.title).toBe('Location access is off');
		expect(result.action).toBe('phone-settings');
	});

	it('offers a retry when the phone cannot find its position', () => {
		const result = describeError(new LocationError('unavailable'));

		expect(result.title).toBe("Can't find your location");
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

	it('opens the phone settings when location access is off', async () => {
		const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
		await renderWith((f) => f.showError(new LocationError('denied')));

		await fireEvent.press(screen.getByText('Open phone settings'));

		expect(openSettings).toHaveBeenCalled();
	});

	it('can show a short error as a toast', async () => {
		await renderWith((f) => f.showError(new ApiError(409, 'You have already voted for this track'), { as: 'toast' }));

		expect(screen.getByText('You have already voted for this track.')).toBeTruthy();
	});
});

describe('ErrorText', () => {
	it('shows the explanation of an error as an alert', async () => {
		await render(<ErrorText error={new ApiError(403, 'Only the owner can manage members')} />);

		expect(screen.getByRole('alert')).toBeTruthy();
		expect(screen.getByText('Only the owner can manage members.')).toBeTruthy();
	});

	it('shows nothing without an error', async () => {
		await render(<ErrorText error={null} />);

		expect(screen.queryByRole('alert')).toBeNull();
	});
});
