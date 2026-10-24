import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { configureApi } from '@/api/client';
import { ApiError } from '@/api/errors';
import PersonScreen from '@/app/(app)/friends/[id]';
import FriendsScreen from '@/app/(app)/friends/index';
import FindPeopleScreen from '@/app/(app)/friends/search';
import { addFriend } from '@/friends/relation';
import { tokenStorage } from '@/session/tokenStorage';
import { failure, mockFetch, renderWithProviders, reply, SERVER } from './helpers';

const ME = { id: 'me', displayName: 'Oleg', email: 'oleg@example.com' };
const MIA = { id: 'u2', displayName: 'Mia', avatarUrl: null };
const LEO = { id: 'u3', displayName: 'Leo', avatarUrl: null };
const ANA = { id: 'u4', displayName: 'Ana', avatarUrl: null };
const REQUEST_FROM_LEO = { id: 'f1', senderId: 'u3', receiverId: 'me', status: 'PENDING', createdAt: '', sender: LEO };
const ALREADY = (status: string) =>
	reply(409, { statusCode: 409, message: `Friendship relation already exists with status: ${status}` });

let fetchMock: jest.Mock;

type Routes = Record<string, unknown>;

// Fake backend: answers by "METHOD /path", logged in as ME
function serve(routes: Routes) {
	fetchMock.mockImplementation(async (url: string, init: { method: string }) => {
		const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
		if (path === '/users/me') return reply(200, ME);
		const answer = routes[`${init.method} ${path}`];
		return answer ?? reply(404, { statusCode: 404, message: `No fake route for ${init.method} ${path}` });
	});
}

const calls = (method: string, path: string) =>
	fetchMock.mock.calls.filter(([url, init]) => init.method === method && url.endsWith(path));

beforeEach(async () => {
	await AsyncStorage.clear();
	await tokenStorage.clear();
	await tokenStorage.set('token', SERVER);
	process.env.EXPO_PUBLIC_API_URL = SERVER;
	fetchMock = mockFetch();
	jest.clearAllMocks();
});

describe('addFriend', () => {
	// No providers here, so the API is pointed at the fake server by hand
	beforeEach(() => configureApi({ baseUrl: SERVER, token: 'token', renew: null }));

	it('sends the request', async () => {
		serve({ 'POST /friends/request': reply(201, {}) });

		await expect(addFriend('u2')).resolves.toBe('sent');
		expect(JSON.parse(calls('POST', '/friends/request')[0][1].body)).toEqual({ receiverId: 'u2' });
	});

	it('counts a request that already exists as sent, or as friends once accepted', async () => {
		serve({ 'POST /friends/request': ALREADY('PENDING') });
		await expect(addFriend('u2')).resolves.toBe('sent');

		serve({ 'POST /friends/request': ALREADY('ACCEPTED') });
		await expect(addFriend('u2')).resolves.toBe('friend');
	});

	it('lets other errors through', async () => {
		serve({ 'POST /friends/request': reply(404, { statusCode: 404, message: 'User not found' }) });

		expect(await failure(addFriend('u2'))).toBeInstanceOf(ApiError);
	});
});

describe('Friends tab', () => {
	it('shows requests waiting for me, then my friends', async () => {
		serve({ 'GET /friends': reply(200, [MIA]), 'GET /friends/requests': reply(200, [REQUEST_FROM_LEO]) });

		await renderWithProviders(<FriendsScreen />);

		expect(await screen.findByText('Requests')).toBeTruthy();
		expect(screen.getByText('Leo')).toBeTruthy();
		expect(screen.getByText('Mia')).toBeTruthy();
	});

	it('says when there are no friends yet', async () => {
		serve({ 'GET /friends': reply(200, []), 'GET /friends/requests': reply(200, []) });

		await renderWithProviders(<FriendsScreen />);

		expect(await screen.findByText('No friends yet')).toBeTruthy();
		expect(screen.queryByText('Requests')).toBeNull();
	});

	it('moves an accepted request into the friends list', async () => {
		serve({
			'GET /friends': reply(200, []),
			'GET /friends/requests': reply(200, [REQUEST_FROM_LEO]),
			'POST /friends/u3/accept': reply(200, {}),
		});
		await renderWithProviders(<FriendsScreen />);

		await fireEvent.press(await screen.findByRole('button', { name: 'Accept' }));

		await waitFor(() => expect(screen.queryByText('Requests')).toBeNull());
		expect(screen.getByText('Leo')).toBeTruthy();
		expect(calls('POST', '/friends/u3/accept')).toHaveLength(1);
	});

	it('shows the error when the first load fails', async () => {
		serve({ 'GET /friends': reply(500, { statusCode: 500, message: 'Internal server error' }) });

		await renderWithProviders(<FriendsScreen />);

		expect(await screen.findByRole('button', { name: 'Try again' })).toBeTruthy();
	});

	it('opens the search and a friend\'s profile', async () => {
		serve({ 'GET /friends': reply(200, [MIA]), 'GET /friends/requests': reply(200, []) });
		await renderWithProviders(<FriendsScreen />);

		await fireEvent.press(await screen.findByRole('button', { name: "Open Mia's profile" }));
		await fireEvent.press(screen.getByRole('button', { name: 'Find people' }));

		expect(router.push).toHaveBeenCalledWith('/friends/u2');
		expect(router.push).toHaveBeenCalledWith('/friends/search');
	});
});

describe('Find people', () => {
	async function searchFor(text: string) {
		await fireEvent.changeText(await screen.findByLabelText('Search people'), text);
	}

	it('shows where I stand with each person, and leaves me out', async () => {
		serve({
			'GET /friends': reply(200, [MIA]),
			'GET /friends/requests': reply(200, [REQUEST_FROM_LEO]),
			'GET /users': reply(200, [ME, MIA, LEO, ANA]),
		});
		await renderWithProviders(<FindPeopleScreen />);

		await searchFor('an');

		expect(await screen.findByRole('button', { name: 'Add Ana' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Accept Leo' })).toBeTruthy();
		// Mia's row, besides the "Friends" back link
		expect(screen.getAllByText('Friends')).toHaveLength(2);
		expect(screen.queryByRole('button', { name: 'Add Mia' })).toBeNull();
		expect(screen.queryByText('Oleg')).toBeNull();
	});

	it('sends a request and marks it sent', async () => {
		serve({
			'GET /friends': reply(200, []),
			'GET /friends/requests': reply(200, []),
			'GET /users': reply(200, [ANA]),
			'POST /friends/request': reply(201, {}),
		});
		await renderWithProviders(<FindPeopleScreen />);
		await searchFor('ana');

		await fireEvent.press(await screen.findByRole('button', { name: 'Add Ana' }));

		expect(await screen.findByText('Sent')).toBeTruthy();
		expect(JSON.parse(calls('POST', '/friends/request')[0][1].body)).toEqual({ receiverId: 'u4' });
	});

	it('accepts a request from the results', async () => {
		serve({
			'GET /friends': reply(200, []),
			'GET /friends/requests': reply(200, [REQUEST_FROM_LEO]),
			'GET /users': reply(200, [LEO]),
			'POST /friends/u3/accept': reply(200, {}),
		});
		await renderWithProviders(<FindPeopleScreen />);
		await searchFor('leo');

		await fireEvent.press(await screen.findByRole('button', { name: 'Accept Leo' }));

		await waitFor(() => expect(screen.getAllByText('Friends')).toHaveLength(2));
		expect(screen.queryByRole('button', { name: 'Accept Leo' })).toBeNull();
	});
});

describe('Person screen', () => {
	const FRIEND_PROFILE = { ...MIA, bio: 'Vinyl only', musicPreference: null, location: 'Lyon', phoneNumber: null };
	const PUBLIC_PROFILE = { ...ANA, bio: null, musicPreference: null };

	it('shows a friend their contact details', async () => {
		(useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'u2' });
		serve({ 'GET /users/u2': reply(200, FRIEND_PROFILE), 'GET /friends/requests': reply(200, []) });

		await renderWithProviders(<PersonScreen />);

		expect(await screen.findByText('Lyon')).toBeTruthy();
		expect(screen.getByText('Friends')).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Add friend' })).toBeNull();
	});

	it('adds someone who is not a friend yet', async () => {
		(useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'u4' });
		serve({
			'GET /users/u4': reply(200, PUBLIC_PROFILE),
			'GET /friends/requests': reply(200, []),
			'POST /friends/request': reply(201, {}),
		});
		await renderWithProviders(<PersonScreen />);

		expect(screen.queryByText('Contact')).toBeNull();
		await fireEvent.press(await screen.findByRole('button', { name: 'Add friend' }));

		expect(await screen.findByText('Request sent')).toBeTruthy();
	});

	it('accepts their request and then shows their contact details', async () => {
		(useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'u3' });
		const leoPublic = { ...LEO, bio: null, musicPreference: null };
		let accepted = false;
		fetchMock.mockImplementation(async (url: string) => {
			const path = url.replace(/^https?:\/\/[^/]+/, '');
			if (path === '/users/me') return reply(200, ME);
			if (path === '/friends/u3/accept') {
				accepted = true;
				return reply(200, {});
			}
			if (path === '/friends/requests') return reply(200, accepted ? [] : [REQUEST_FROM_LEO]);
			if (path === '/users/u3') return reply(200, accepted ? { ...leoPublic, location: 'Porto', phoneNumber: null } : leoPublic);
			return reply(404, { statusCode: 404, message: 'Not found' });
		});
		await renderWithProviders(<PersonScreen />);

		await fireEvent.press(await screen.findByRole('button', { name: 'Accept friend request' }));

		expect(await screen.findByText('Porto')).toBeTruthy();
		expect(calls('POST', '/friends/u3/accept')).toHaveLength(1);
	});
});
