import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import RoomsScreen from '@/app/(app)/rooms/index';
import SettingsScreen from '@/app/settings';
import { configureApi } from '@/api/client';
import { FeedbackProvider } from '@/feedback/FeedbackProvider';
import { tokenStorage } from '@/session/tokenStorage';
import { mockFetch, renderWithProviders, reply } from './helpers';

let fetchMock: jest.Mock;

beforeEach(async () => {
	await AsyncStorage.clear();
	await tokenStorage.clear();
	process.env.EXPO_PUBLIC_API_URL = 'http://192.168.1.10:8080';
	fetchMock = mockFetch();
	(router.push as jest.Mock).mockReset();
});

describe('Settings screen', () => {
	async function renderSettings() {
		await renderWithProviders(<SettingsScreen />);
		await waitFor(() => expect(screen.getByLabelText('Backend address').props.value).toBeTruthy());
	}

	it('shows the current backend address', async () => {
		await renderSettings();

		expect(screen.getByLabelText('Backend address').props.value).toBe('http://192.168.1.10:8080');
	});

	it('explains what is wrong with an invalid address', async () => {
		await renderSettings();

		await fireEvent.changeText(screen.getByLabelText('Backend address'), '  ');
		await fireEvent.press(screen.getByRole('button', { name: 'Save and test' }));

		expect(screen.getByText('Enter the backend address.')).toBeTruthy();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('saves the address and confirms the backend answers', async () => {
		fetchMock.mockResolvedValue(reply(200, { status: 'ok' }));
		await renderSettings();

		await fireEvent.changeText(screen.getByLabelText('Backend address'), '10.0.0.5:8080');
		await fireEvent.press(screen.getByRole('button', { name: 'Save and test' }));

		await waitFor(() => expect(screen.getByText('Connected to http://10.0.0.5:8080')).toBeTruthy());
		expect(fetchMock.mock.calls[0][0]).toBe('http://10.0.0.5:8080/health');
		expect(await AsyncStorage.getItem('serverUrl')).toBe('http://10.0.0.5:8080');
	});

	it('saves the address but warns when nothing answers', async () => {
		fetchMock.mockRejectedValue(new TypeError('Network request failed'));
		await renderSettings();

		await fireEvent.changeText(screen.getByLabelText('Backend address'), '10.0.0.5:8080');
		await fireEvent.press(screen.getByRole('button', { name: 'Save and test' }));

		await waitFor(() =>
			expect(
				screen.getByText(
					'Saved, but nothing answered at http://10.0.0.5:8080. Check the address and that the backend is running.',
				),
			).toBeTruthy(),
		);
	});

	it('goes back to the default address', async () => {
		await AsyncStorage.setItem('serverUrl', 'http://10.0.0.5:8080');
		await renderSettings();

		await fireEvent.press(screen.getByRole('button', { name: 'Use default address' }));

		await waitFor(() =>
			expect(screen.getByLabelText('Backend address').props.value).toBe('http://192.168.1.10:8080'),
		);
	});

	it('logs out when logged in', async () => {
		await tokenStorage.set('saved-token');
		fetchMock.mockResolvedValue(reply(200, { id: 'u1', displayName: 'Test User 1' }));
		await renderSettings();
		await waitFor(() => expect(screen.getByText('Logged in as Test User 1')).toBeTruthy());

		await fireEvent.press(screen.getByRole('button', { name: 'Log out' }));

		await waitFor(() => expect(screen.queryByText('Logged in as Test User 1')).toBeNull());
		expect(await tokenStorage.get()).toBeNull();
	});
});

describe('Rooms screen', () => {
	const ROOMS = [
		{ id: 'r1', name: 'Friday Night Vote', kind: 'VOTE', visibility: 'PUBLIC' },
		{ id: 'r2', name: 'Road Trip', kind: 'PLAYLIST', visibility: 'PRIVATE' },
	];

	async function renderRooms() {
		await render(
			<FeedbackProvider>
				<RoomsScreen />
			</FeedbackProvider>,
		);
	}

	beforeEach(() => {
		configureApi({ baseUrl: 'http://192.168.1.10:8080', token: 'token' });
	});

	it('lists the rooms with their kind', async () => {
		fetchMock.mockResolvedValue(reply(200, ROOMS));

		await renderRooms();

		await waitFor(() => expect(screen.getByText('Friday Night Vote')).toBeTruthy());
		expect(screen.getByText('Track vote')).toBeTruthy();
		expect(screen.getByText('Road Trip')).toBeTruthy();
		expect(screen.getByText('Playlist')).toBeTruthy();
		expect(screen.getByLabelText('Private room')).toBeTruthy();
	});

	it('says when there are no rooms yet', async () => {
		fetchMock.mockResolvedValue(reply(200, []));

		await renderRooms();

		await waitFor(() => expect(screen.getByText('No rooms yet')).toBeTruthy());
	});

	it('explains a failed load and lets the user retry', async () => {
		fetchMock.mockResolvedValueOnce(reply(500, { statusCode: 500, message: 'Internal server error' }));
		fetchMock.mockResolvedValueOnce(reply(200, ROOMS));

		await renderRooms();
		await waitFor(() => expect(screen.getByText('Server error')).toBeTruthy());
		await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

		await waitFor(() => expect(screen.getByText('Friday Night Vote')).toBeTruthy());
	});

	it('offers to open settings when the server is unreachable', async () => {
		fetchMock.mockRejectedValue(new TypeError('Network request failed'));

		await renderRooms();
		await waitFor(() => expect(screen.getByText("Can't reach the server")).toBeTruthy());
		await fireEvent.press(screen.getByRole('button', { name: 'Open settings' }));

		expect(router.push).toHaveBeenCalledWith('/settings');
	});

	it('shows whether live updates are connected', async () => {
		fetchMock.mockResolvedValue(reply(200, []));

		await renderRooms();

		expect(screen.getByText('Off air')).toBeTruthy();
	});
});
