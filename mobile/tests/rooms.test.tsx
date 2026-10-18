import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import * as Audio from 'expo-audio';
import AddTrackScreen from '@/app/(app)/rooms/add-track';
import InviteScreen from '@/app/(app)/rooms/invite';
import NewRoomScreen from '@/app/(app)/rooms/new';
import RoomScreen from '@/app/(app)/rooms/[id]';
import { currentPosition, LocationError } from '@/lib/location';
import { emptyRoomForm, validateRoomForm, type RoomForm } from '@/rooms/roomForm';
import { tokenStorage } from '@/session/tokenStorage';
import { SocketContext } from '@/socket/SocketProvider';
import { FakeSocket, mockFetch, renderWithProviders, reply, routeFetch, SERVER } from './helpers';

// Local times, so the tests pass in any time zone
const TODAY = new Date(2026, 9, 14, 18, 0);
const at = (hours: number, minutes = 0) => new Date(2026, 9, 14, hours, minutes);

function form(changes: Partial<RoomForm> = {}): RoomForm {
	return { ...emptyRoomForm(TODAY), name: 'Rooftop Friday', ...changes };
}

describe('validateRoomForm', () => {
	it('builds an open public vote room by default', () => {
		expect(validateRoomForm(form(), TODAY)).toEqual({
			ok: true,
			input: { name: 'Rooftop Friday', kind: 'VOTE', visibility: 'PUBLIC', accessPolicy: 'OPEN' },
		});
	});

	it('requires a name', () => {
		const result = validateRoomForm(form({ name: '   ' }), TODAY);

		expect(result).toEqual({ ok: false, errors: { name: 'Give the room a name.' } });
	});

	it('limits the name to 100 characters', () => {
		const result = validateRoomForm(form({ name: 'a'.repeat(101) }), TODAY);

		expect(result).toEqual({ ok: false, errors: { name: 'Keep the name under 100 characters.' } });
	});

	it('keeps the description when there is one', () => {
		const result = validateRoomForm(form({ description: '  Bring your headphones ' }), TODAY);

		expect(result.ok && result.input.description).toBe('Bring your headphones');
	});

	it('needs a place for a place-and-time room', () => {
		const result = validateRoomForm(form({ license: 'RESTRICTED', position: null }), TODAY);

		expect(result).toEqual({ ok: false, errors: { position: 'Set the room\'s place with "Use my current location".' } });
	});

	it('sends the place, radius and time window of a place-and-time room', () => {
		const result = validateRoomForm(
			form({ license: 'RESTRICTED', position: { lat: 13.75, lng: 100.5 }, radiusM: 300, start: at(16), end: at(18) }),
			TODAY,
		);

		expect(result).toEqual({
			ok: true,
			input: {
				name: 'Rooftop Friday',
				kind: 'VOTE',
				visibility: 'PUBLIC',
				accessPolicy: 'RESTRICTED',
				locationLat: 13.75,
				locationLng: 100.5,
				locationRadiusM: 300,
				windowStart: at(16).toISOString(),
				windowEnd: at(18).toISOString(),
			},
		});
	});

	it('ends the time window the next day when it crosses midnight', () => {
		const result = validateRoomForm(
			form({ license: 'RESTRICTED', position: { lat: 1, lng: 2 }, start: at(20), end: at(2) }),
			TODAY,
		);

		expect(result.ok && result.input.windowEnd).toBe(new Date(2026, 9, 15, 2, 0).toISOString());
	});

	it('refuses a time window that opens and closes at the same time', () => {
		const result = validateRoomForm(
			form({ license: 'RESTRICTED', position: { lat: 1, lng: 2 }, start: at(20), end: at(20) }),
			TODAY,
		);

		expect(result).toEqual({ ok: false, errors: { time: 'The room must open and close at different times.' } });
	});
});

describe('currentPosition', () => {
	it('returns the phone position', async () => {
		await expect(currentPosition()).resolves.toEqual({ lat: 13.7563, lng: 100.5018 });
	});

	it('reports a refused location access', async () => {
		(Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });

		const error = await currentPosition().catch((e) => e);

		expect(error).toBeInstanceOf(LocationError);
		expect(error.reason).toBe('denied');
	});

	it('reports a phone that cannot find its position', async () => {
		(Location.getCurrentPositionAsync as jest.Mock).mockRejectedValueOnce(new Error('Location services off'));

		const error = await currentPosition().catch((e) => e);

		expect(error.reason).toBe('unavailable');
	});
});

const VOTE_ROOM = {
	id: 'r1',
	name: 'Rooftop Friday',
	kind: 'VOTE',
	visibility: 'PUBLIC',
	accessPolicy: 'OPEN',
	ownerId: 'someone-else',
};
const ME = { id: 'me', displayName: 'Ben', email: 'ben@example.com' };
const VOTE_TRACKS = [
	{ id: 't1', title: 'Midnight City', artist: 'M83', score: 12, position: null },
	{ id: 't2', title: 'Electric Feel', artist: 'MGMT', score: 9, position: null },
];

describe('Room screen', () => {
	let fetchMock: jest.Mock;

	beforeEach(async () => {
		await AsyncStorage.clear();
		await tokenStorage.clear();
		process.env.EXPO_PUBLIC_API_URL = 'http://192.168.1.10:8080';
		fetchMock = mockFetch();
		(useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'r1' });
	});

	it('shows the room, its rules and the tracks by votes', async () => {
		routeFetch(fetchMock, { '/rooms/r1': reply(200, VOTE_ROOM), '/rooms/r1/tracks': reply(200, VOTE_TRACKS) });

		await renderWithProviders(<RoomScreen />);

		await waitFor(() => expect(screen.getByText('Midnight City')).toBeTruthy());
		expect(screen.getByRole('header', { name: 'Rooftop Friday' })).toBeTruthy();
		expect(screen.getByText('Track vote')).toBeTruthy();
		expect(screen.getByText('Anyone can vote')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Vote for Midnight City' }).props.accessibilityValue).toEqual({
			text: '12 votes',
		});
	});

	it('shows a playlist in its order', async () => {
		routeFetch(fetchMock, {
			'/rooms/r1': reply(200, { ...VOTE_ROOM, kind: 'PLAYLIST', accessPolicy: 'INVITE_ONLY' }),
			'/rooms/r1/tracks': reply(200, [{ id: 't1', title: 'Holocene', artist: 'Bon Iver', score: 0, position: 'm' }]),
		});

		await renderWithProviders(<RoomScreen />);

		await waitFor(() => expect(screen.getByText('Holocene')).toBeTruthy());
		expect(screen.getByText('Playlist')).toBeTruthy();
		expect(screen.getByText('Invited people can edit')).toBeTruthy();
	});

	it('says when there are no tracks yet', async () => {
		routeFetch(fetchMock, { '/rooms/r1': reply(200, VOTE_ROOM), '/rooms/r1/tracks': reply(200, []) });

		await renderWithProviders(<RoomScreen />);

		await waitFor(() => expect(screen.getByText('No tracks yet')).toBeTruthy());
	});

	it('shows a place-and-time room without asking where the phone is', async () => {
		routeFetch(fetchMock, {
			'/rooms/r1': reply(200, { ...VOTE_ROOM, accessPolicy: 'RESTRICTED' }),
			'/rooms/r1/tracks': reply(200, VOTE_TRACKS),
		});
		(Location.getCurrentPositionAsync as jest.Mock).mockClear();

		await renderWithProviders(<RoomScreen />);

		await waitFor(() => expect(screen.getByText('Midnight City')).toBeTruthy());
		const tracksCall = fetchMock.mock.calls.find(([url]) => url.includes('/tracks'));
		expect(tracksCall[0]).not.toContain('lat=');
		expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
	});

	it('lets people who are not invited follow, but not vote', async () => {
		await tokenStorage.set('token', SERVER);
		routeFetch(fetchMock, {
			'/users/me': reply(200, ME),
			'/rooms/r1': reply(200, { ...VOTE_ROOM, accessPolicy: 'INVITE_ONLY', members: [] }),
			'/rooms/r1/tracks': reply(200, VOTE_TRACKS),
		});

		await renderWithProviders(<RoomScreen />);

		expect(await screen.findByText('Only invited people can vote here.')).toBeTruthy();
		expect(screen.getByLabelText('12 votes')).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Vote for Midnight City' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Suggest a track' })).toBeNull();
	});

	it('lets invited people vote in an invite-only room', async () => {
		await tokenStorage.set('token', SERVER);
		routeFetch(fetchMock, {
			'/users/me': reply(200, ME),
			'/rooms/r1': reply(200, { ...VOTE_ROOM, accessPolicy: 'INVITE_ONLY', members: [{ roomId: 'r1', userId: 'me' }] }),
			'/rooms/r1/tracks': reply(200, VOTE_TRACKS),
		});

		await renderWithProviders(<RoomScreen />);

		expect(await screen.findByRole('button', { name: 'Vote for Midnight City' })).toBeTruthy();
		expect(screen.queryByText('Only invited people can vote here.')).toBeNull();
	});

	it('explains why the user cannot take part', async () => {
		routeFetch(fetchMock, {
			'/rooms/r1': reply(200, { ...VOTE_ROOM, accessPolicy: 'INVITE_ONLY' }),
			'/rooms/r1/tracks': reply(403, { statusCode: 403, message: 'This room is invite-only' }),
		});

		await renderWithProviders(<RoomScreen />);

		await waitFor(() => expect(screen.getByText('Invite only')).toBeTruthy());
	});

	it('votes for a track, then takes the vote back', async () => {
		// Fake server that remembers the vote, like the real one
		let votedT2 = false;
		fetchMock.mockImplementation(async (url: string, init: { method: string }) => {
			const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
			if (path === '/rooms/r1') return reply(200, VOTE_ROOM);
			if (path === '/rooms/r1/tracks/t2/vote') {
				votedT2 = init.method === 'POST';
				return reply(201, {});
			}
			return reply(200, VOTE_TRACKS.map((track) => ({ ...track, votedByMe: track.id === 't2' && votedT2 })));
		});
		await renderWithProviders(<RoomScreen />);
		const vote = await screen.findByRole('button', { name: 'Vote for Electric Feel' });

		await fireEvent.press(vote);
		await waitFor(() => expect(vote.props.accessibilityState).toMatchObject({ selected: true }));
		await fireEvent.press(vote);
		await waitFor(() => expect(vote.props.accessibilityState).toMatchObject({ selected: false }));

		const voteCalls = fetchMock.mock.calls.filter(([url]) => url.includes('/vote'));
		expect(voteCalls.map(([, init]) => init.method)).toEqual(['POST', 'DELETE']);
	});

	it('shows the votes the user already gave', async () => {
		routeFetch(fetchMock, {
			'/rooms/r1': reply(200, VOTE_ROOM),
			'/rooms/r1/tracks': reply(200, [{ ...VOTE_TRACKS[0], votedByMe: true }, { ...VOTE_TRACKS[1], votedByMe: false }]),
		});
		await renderWithProviders(<RoomScreen />);

		const voted = await screen.findByRole('button', { name: 'Vote for Midnight City' });

		await waitFor(() => expect(voted.props.accessibilityState).toMatchObject({ selected: true }));
		expect(screen.getByRole('button', { name: 'Vote for Electric Feel' }).props.accessibilityState).toMatchObject({
			selected: false,
		});
	});

	it('explains a refused vote', async () => {
		routeFetch(fetchMock, {
			'/rooms/r1': reply(200, VOTE_ROOM),
			'/rooms/r1/tracks': reply(200, VOTE_TRACKS),
			'/rooms/r1/tracks/t1/vote': reply(403, { statusCode: 403, message: 'This room is outside its active time window' }),
		});
		await renderWithProviders(<RoomScreen />);

		await fireEvent.press(await screen.findByRole('button', { name: 'Vote for Midnight City' }));

		await waitFor(() => expect(screen.getByText('Closed right now')).toBeTruthy());
		expect(screen.getByRole('button', { name: 'Vote for Midnight City' }).props.accessibilityState).toMatchObject({
			selected: false,
		});
	});

	it('keeps the vote when the server already counted it', async () => {
		routeFetch(fetchMock, {
			'/rooms/r1': reply(200, VOTE_ROOM),
			'/rooms/r1/tracks': reply(200, VOTE_TRACKS),
			'/rooms/r1/tracks/t1/vote': reply(409, { statusCode: 409, message: 'You have already voted for this track' }),
		});
		await renderWithProviders(<RoomScreen />);
		const vote = await screen.findByRole('button', { name: 'Vote for Midnight City' });

		await fireEvent.press(vote);

		await waitFor(() => expect(vote.props.accessibilityState).toMatchObject({ selected: true }));
		expect(screen.queryByText('Already done')).toBeNull();
	});

	it('checks where the phone is again before a vote in a place-and-time room', async () => {
		routeFetch(fetchMock, {
			'/rooms/r1': reply(200, { ...VOTE_ROOM, accessPolicy: 'RESTRICTED' }),
			'/rooms/r1/tracks': reply(200, VOTE_TRACKS),
			'/rooms/r1/tracks/t1/vote': reply(201, {}),
		});
		await renderWithProviders(<RoomScreen />);
		const vote = await screen.findByRole('button', { name: 'Vote for Midnight City' });
		(Location.getCurrentPositionAsync as jest.Mock).mockClear();

		await fireEvent.press(vote);

		await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url.includes('/vote'))).toBe(true));
		const voteCall = fetchMock.mock.calls.find(([url]) => url.includes('/vote'));
		expect(voteCall[0]).toContain('/vote?lat=13.7563&lng=100.5018');
		expect(Location.getCurrentPositionAsync).toHaveBeenCalled();
	});

	it('opens the track search for this room', async () => {
		(router.push as jest.Mock).mockReset();
		routeFetch(fetchMock, { '/rooms/r1': reply(200, VOTE_ROOM), '/rooms/r1/tracks': reply(200, []) });
		await renderWithProviders(<RoomScreen />);

		await fireEvent.press(await screen.findByRole('button', { name: 'Suggest a track' }));

		expect(router.push).toHaveBeenCalledWith({ pathname: '/rooms/add-track', params: { roomId: 'r1', kind: 'VOTE' } });
	});

	it('lets the owner invite people to an invite-only room', async () => {
		(router.push as jest.Mock).mockReset();
		await tokenStorage.set('token', SERVER);
		routeFetch(fetchMock, {
			'/users/me': reply(200, ME),
			'/rooms/r1': reply(200, { ...VOTE_ROOM, accessPolicy: 'INVITE_ONLY', ownerId: 'me' }),
			'/rooms/r1/tracks': reply(200, []),
		});
		await renderWithProviders(<RoomScreen />);

		await fireEvent.press(await screen.findByRole('button', { name: 'Invite people' }));

		expect(router.push).toHaveBeenCalledWith({ pathname: '/rooms/invite', params: { roomId: 'r1' } });
	});

	it('shows invites only to the owner, and only where they matter', async () => {
		await tokenStorage.set('token', SERVER);
		routeFetch(fetchMock, {
			'/users/me': reply(200, ME),
			'/rooms/r1': reply(200, { ...VOTE_ROOM, ownerId: 'me' }),
			'/rooms/r1/tracks': reply(200, []),
		});
		const view = await renderWithProviders(<RoomScreen />);
		await screen.findByRole('button', { name: 'Suggest a track' });
		expect(screen.queryByRole('button', { name: 'Invite people' })).toBeNull();
		await view.unmount();

		routeFetch(fetchMock, {
			'/users/me': reply(200, ME),
			'/rooms/r1': reply(200, { ...VOTE_ROOM, visibility: 'PRIVATE' }),
			'/rooms/r1/tracks': reply(200, []),
		});
		await renderWithProviders(<RoomScreen />);
		await screen.findByRole('button', { name: 'Suggest a track' });
		expect(screen.queryByRole('button', { name: 'Invite people' })).toBeNull();
	});

	describe('playlist', () => {
		const PLAYLIST_ROOM = { ...VOTE_ROOM, kind: 'PLAYLIST' };
		const PLAYLIST = [
			{ id: 't1', title: 'Holocene', artist: 'Bon Iver', score: 0, position: 'a' },
			{ id: 't2', title: 'Skinny Love', artist: 'Bon Iver', score: 0, position: 'b' },
			{ id: 't3', title: 'Re: Stacks', artist: 'Bon Iver', score: 0, position: 'c' },
		];
		const order = () => screen.getAllByLabelText(/^Move /).map((handle) => handle.props.accessibilityLabel);
		const action = (label: string, actionName: string) =>
			fireEvent(screen.getByLabelText(label), 'accessibilityAction', { nativeEvent: { actionName } });

		function serve(routes: Record<string, unknown> = {}, room: object = PLAYLIST_ROOM) {
			routeFetch(fetchMock, {
				'/users/me': reply(200, ME),
				'/rooms/r1': reply(200, room),
				'/rooms/r1/tracks': reply(200, PLAYLIST),
				...routes,
			});
		}

		it('moves a track down and tells the server where it goes', async () => {
			// Fake server that keeps the new order, like the real one
			let moved = false;
			fetchMock.mockImplementation(async (url: string, init: { method: string }) => {
				const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
				if (path === '/rooms/r1') return reply(200, PLAYLIST_ROOM);
				if (path === '/rooms/r1/tracks/t1/position') {
					moved = true;
					return reply(200, {});
				}
				return reply(200, moved ? [PLAYLIST[1], PLAYLIST[0], PLAYLIST[2]] : PLAYLIST);
			});
			await renderWithProviders(<RoomScreen />);
			await screen.findByLabelText('Move Holocene');

			await action('Move Holocene', 'moveDown');

			expect(order()).toEqual(['Move Skinny Love', 'Move Holocene', 'Move Re: Stacks']);
			await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init.method === 'PATCH')).toBe(true));
			const moveCall = fetchMock.mock.calls.find(([, init]) => init.method === 'PATCH');
			expect(moveCall[0]).toContain('/rooms/r1/tracks/t1/position');
			expect(JSON.parse(moveCall[1].body)).toEqual({ afterTrackId: 't2' });
		});

		it('moves a track to the top', async () => {
			serve({ '/rooms/r1/tracks/t2/position': reply(200, {}) });
			await renderWithProviders(<RoomScreen />);
			await screen.findByLabelText('Move Skinny Love');

			await action('Move Skinny Love', 'moveUp');

			await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init.method === 'PATCH')).toBe(true));
			const moveCall = fetchMock.mock.calls.find(([, init]) => init.method === 'PATCH');
			expect(JSON.parse(moveCall[1].body)).toEqual({ afterTrackId: null });
		});

		it('puts the list back when a move is refused', async () => {
			serve({
				'/rooms/r1/tracks/t1/position': reply(403, { statusCode: 403, message: 'This room is invite-only' }),
			});
			await renderWithProviders(<RoomScreen />);
			await screen.findByLabelText('Move Holocene');

			await action('Move Holocene', 'moveDown');

			await waitFor(() => expect(screen.getByText('Invite only')).toBeTruthy());
			await waitFor(() => expect(order()).toEqual(['Move Holocene', 'Move Skinny Love', 'Move Re: Stacks']));
		});

		it('lets anyone who can edit remove a track, after confirming', async () => {
			serve({ '/rooms/r1/tracks/t2': reply(200, {}) });
			await renderWithProviders(<RoomScreen />);

			await fireEvent.press(await screen.findByRole('button', { name: 'Remove Skinny Love' }));
			await fireEvent.press(screen.getByRole('button', { name: 'Remove' }));

			await waitFor(() => expect(screen.getByText('Track removed')).toBeTruthy());
			const removeCall = fetchMock.mock.calls.find(([, init]) => init.method === 'DELETE');
			expect(removeCall[0]).toContain('/rooms/r1/tracks/t2');
		});

		it('lets people who are not invited follow the playlist, but not edit it', async () => {
			await tokenStorage.set('token', SERVER);
			serve({}, { ...PLAYLIST_ROOM, accessPolicy: 'INVITE_ONLY', members: [] });
			const view = await renderWithProviders(<RoomScreen />);

			expect(await screen.findByText('Only invited people can edit this playlist.')).toBeTruthy();
			expect(screen.getByText('Holocene')).toBeTruthy();
			expect(screen.queryByLabelText(/^Move /)).toBeNull();
			expect(screen.queryByRole('button', { name: 'Remove Holocene' })).toBeNull();
			expect(screen.queryByRole('button', { name: 'Add a track' })).toBeNull();
			await view.unmount();

			routeFetch(fetchMock, { '/rooms/r1': reply(200, VOTE_ROOM), '/rooms/r1/tracks': reply(200, VOTE_TRACKS) });
			await renderWithProviders(<RoomScreen />);
			await screen.findByText('Midnight City');
			expect(screen.queryByLabelText(/^Move /)).toBeNull();
			expect(screen.queryByRole('button', { name: 'Remove Midnight City' })).toBeNull();
		});
	});

	it('explains a room that no longer exists', async () => {
		routeFetch(fetchMock, { '/rooms/r1': reply(404, { statusCode: 404, message: 'Room not found' }) });

		await renderWithProviders(<RoomScreen />);

		await waitFor(() => expect(screen.getByText('Room not found.')).toBeTruthy());
	});
});

describe('New room screen', () => {
	let fetchMock: jest.Mock;

	beforeEach(async () => {
		await AsyncStorage.clear();
		await tokenStorage.clear();
		process.env.EXPO_PUBLIC_API_URL = 'http://192.168.1.10:8080';
		fetchMock = mockFetch();
		(router.push as jest.Mock).mockReset();
		(router.dismiss as jest.Mock).mockReset();
	});

	async function renderForm() {
		await renderWithProviders(<NewRoomScreen />);
		await waitFor(() => expect(screen.getByLabelText('Name')).toBeTruthy());
	}

	it('creates a public vote room open to everyone, then opens it', async () => {
		routeFetch(fetchMock, { '/rooms': reply(201, { id: 'r9', name: 'Rooftop Friday' }) });
		await renderForm();

		await fireEvent.changeText(screen.getByLabelText('Name'), 'Rooftop Friday');
		await fireEvent.press(screen.getByRole('button', { name: 'Create room' }));

		await waitFor(() => expect(router.push).toHaveBeenCalledWith('/rooms/r9'));
		const body = JSON.parse(fetchMock.mock.calls[0][1].body);
		expect(body).toEqual({ name: 'Rooftop Friday', kind: 'VOTE', visibility: 'PUBLIC', accessPolicy: 'OPEN' });
		expect(router.dismiss).toHaveBeenCalled();
	});

	it('explains a missing name under the field', async () => {
		await renderForm();

		await fireEvent.press(screen.getByRole('button', { name: 'Create room' }));

		expect(screen.getByText('Give the room a name.')).toBeTruthy();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('shows place and time settings only when chosen', async () => {
		await renderForm();
		expect(screen.queryByRole('button', { name: 'Use my current location' })).toBeNull();

		await fireEvent.press(screen.getByRole('radio', { name: 'Place and time' }));

		expect(screen.getByRole('button', { name: 'Use my current location' })).toBeTruthy();
		expect(screen.getByText('Opens at')).toBeTruthy();
		expect(screen.getByText('Closes at')).toBeTruthy();
	});

	it('offers place and time only for track votes', async () => {
		await renderForm();

		await fireEvent.press(screen.getByRole('radio', { name: 'Playlist' }));

		expect(screen.queryByRole('radio', { name: 'Place and time' })).toBeNull();
		expect(screen.getByText('Who can edit')).toBeTruthy();
	});

	it("sets the room's place from the phone position", async () => {
		await renderForm();
		await fireEvent.press(screen.getByRole('radio', { name: 'Place and time' }));

		await fireEvent.press(screen.getByRole('button', { name: 'Use my current location' }));

		await waitFor(() => expect(screen.getByText('Place set where you are now')).toBeTruthy());
	});

	it('explains when location access is refused', async () => {
		(Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
		await renderForm();
		await fireEvent.press(screen.getByRole('radio', { name: 'Place and time' }));

		await fireEvent.press(screen.getByRole('button', { name: 'Use my current location' }));

		await waitFor(() =>
			expect(screen.getByText("Allow location access in your phone's settings, then try again.")).toBeTruthy(),
		);
	});

	it('shows why the server refused the room', async () => {
		routeFetch(fetchMock, { '/rooms': reply(400, { statusCode: 400, message: ['name must be shorter than or equal to 100 characters'] }) });
		await renderForm();

		await fireEvent.changeText(screen.getByLabelText('Name'), 'Rooftop Friday');
		await fireEvent.press(screen.getByRole('button', { name: 'Create room' }));

		await waitFor(() => expect(screen.getByText('Name must be shorter than or equal to 100 characters.')).toBeTruthy());
		expect(router.push).not.toHaveBeenCalled();
	});
});

describe('Add track screen', () => {
	let fetchMock: jest.Mock;
	const RESULTS = [
		{ providerId: '3135556', title: 'Harder, Better, Faster, Stronger', artist: 'Daft Punk', durationMs: 224000, previewUrl: null, albumCoverUrl: null },
		{ providerId: '3135553', title: 'One More Time', artist: 'Daft Punk', durationMs: 320000, previewUrl: null, albumCoverUrl: null },
	];

	beforeEach(async () => {
		await AsyncStorage.clear();
		await tokenStorage.clear();
		process.env.EXPO_PUBLIC_API_URL = 'http://192.168.1.10:8080';
		fetchMock = mockFetch();
		(useLocalSearchParams as jest.Mock).mockReturnValue({ roomId: 'r1', kind: 'VOTE' });
		(router.back as jest.Mock).mockReset();
	});

	async function search(text: string) {
		await renderWithProviders(<AddTrackScreen />);
		await fireEvent.changeText(await screen.findByLabelText('Search Deezer'), text);
	}

	it('finds tracks once the user stops typing', async () => {
		routeFetch(fetchMock, { '/rooms/r1/tracks/search': reply(200, RESULTS) });

		await search('daft punk');

		await waitFor(() => expect(screen.getByText('One More Time')).toBeTruthy());
		expect(screen.getByText('3:44')).toBeTruthy();
		expect(fetchMock.mock.calls[0][0]).toContain('/rooms/r1/tracks/search?query=daft%20punk');
	});

	it('suggests the chosen track, then goes back to the room', async () => {
		routeFetch(fetchMock, {
			'/rooms/r1/tracks/search': reply(200, RESULTS),
			'/rooms/r1/tracks': reply(201, { id: 't9' }),
		});
		await search('daft punk');

		await fireEvent.press(await screen.findByRole('button', { name: 'Suggest One More Time by Daft Punk' }));

		await waitFor(() => expect(router.back).toHaveBeenCalled());
		const addCall = fetchMock.mock.calls.find(([, init]) => init.method === 'POST');
		expect(JSON.parse(addCall[1].body)).toEqual({ deezerTrackId: '3135553' });
		expect(screen.getByText('Track suggested')).toBeTruthy();
	});

	it('says when nothing matches', async () => {
		routeFetch(fetchMock, { '/rooms/r1/tracks/search': reply(200, []) });

		await search('zzqx');

		await waitFor(() => expect(screen.getByText('No tracks found for "zzqx"')).toBeTruthy());
	});

	it('explains a track that is already in the room', async () => {
		routeFetch(fetchMock, {
			'/rooms/r1/tracks/search': reply(200, RESULTS),
			'/rooms/r1/tracks': reply(409, { statusCode: 409, message: 'This track has already been added to the room' }),
		});
		await search('daft punk');

		await fireEvent.press(await screen.findByRole('button', { name: 'Suggest One More Time by Daft Punk' }));

		await waitFor(() => expect(screen.getByText('Already in this room')).toBeTruthy());
		expect(router.back).not.toHaveBeenCalled();
	});

	it('says when Deezer is down', async () => {
		routeFetch(fetchMock, { '/rooms/r1/tracks/search': reply(502, { statusCode: 502, message: 'Could not reach Deezer' }) });

		await search('daft punk');

		await waitFor(() => expect(screen.getByText('Music service unavailable')).toBeTruthy());
	});

	it('checks where the phone is when adding to a place-and-time room', async () => {
		(useLocalSearchParams as jest.Mock).mockReturnValue({ roomId: 'r1', kind: 'VOTE', needsPosition: '1' });
		routeFetch(fetchMock, {
			'/rooms/r1/tracks/search': reply(200, RESULTS),
			'/rooms/r1/tracks': reply(201, { id: 't9' }),
		});
		await search('daft punk');

		await fireEvent.press(await screen.findByRole('button', { name: 'Suggest One More Time by Daft Punk' }));

		await waitFor(() => expect(router.back).toHaveBeenCalled());
		const searchCall = fetchMock.mock.calls.find(([url]) => url.includes('/search'));
		expect(searchCall[0]).not.toContain('lat=');
		const addCall = fetchMock.mock.calls.find(([, init]) => init.method === 'POST');
		expect(addCall[0]).toContain('/rooms/r1/tracks?lat=13.7563&lng=100.5018');
	});

	it('adds to a playlist with playlist words', async () => {
		(useLocalSearchParams as jest.Mock).mockReturnValue({ roomId: 'r1', kind: 'PLAYLIST' });
		routeFetch(fetchMock, { '/rooms/r1/tracks/search': reply(200, RESULTS) });

		await search('daft punk');

		expect(screen.getByRole('header', { name: 'Add a track' })).toBeTruthy();
		expect(await screen.findByRole('button', { name: 'Add One More Time by Daft Punk' })).toBeTruthy();
	});
});

describe('Invite screen', () => {
	let fetchMock: jest.Mock;
	const MIA = { id: 'u2', displayName: 'Mia', avatarUrl: null };
	const LEO = { id: 'u3', displayName: 'Leo', avatarUrl: null };

	beforeEach(async () => {
		await AsyncStorage.clear();
		await tokenStorage.clear();
		await tokenStorage.set('token', SERVER);
		process.env.EXPO_PUBLIC_API_URL = SERVER;
		fetchMock = mockFetch();
		(useLocalSearchParams as jest.Mock).mockReturnValue({ roomId: 'r1' });
	});

	function serve(members: unknown[], invite = reply(201, {}), removal = reply(200, {})) {
		fetchMock.mockImplementation(async (url: string, init: { method: string }) => {
			const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
			if (path === '/users/me') return reply(200, ME);
			if (path.startsWith('/rooms/r1/members/')) return removal;
			if (path === '/users') return reply(200, [ME, MIA, LEO]);
			if (path === '/rooms/r1/members') return init.method === 'POST' ? invite : reply(200, members);
			return reply(404, { statusCode: 404, message: 'Not found' });
		});
	}

	async function searchPeople(text: string) {
		await fireEvent.changeText(await screen.findByLabelText('Search people'), text);
	}

	it('shows who is already invited', async () => {
		serve([{ id: 'm1', roomId: 'r1', userId: 'u2', user: MIA }]);

		await renderWithProviders(<InviteScreen />);

		expect(await screen.findByText('Mia')).toBeTruthy();
		expect(screen.getByText('Invited (1)')).toBeTruthy();
	});

	it('finds people, leaves out the owner, and invites the chosen one', async () => {
		serve([]);
		await renderWithProviders(<InviteScreen />);
		await searchPeople('e');
		await searchPeople('le');

		await fireEvent.press(await screen.findByRole('button', { name: 'Invite Leo' }));

		await waitFor(() => expect(screen.getByText('Leo invited')).toBeTruthy());
		expect(screen.queryByRole('button', { name: 'Invite Ben' })).toBeNull();
		const inviteCall = fetchMock.mock.calls.find(([, init]) => init.method === 'POST');
		expect(JSON.parse(inviteCall[1].body)).toEqual({ userId: 'u3' });
		expect(screen.getByRole('button', { name: 'Remove Leo' }).props.accessibilityState).toMatchObject({ selected: true });
	});

	it('marks people who are already invited', async () => {
		serve([{ id: 'm1', roomId: 'r1', userId: 'u2', user: MIA }]);
		await renderWithProviders(<InviteScreen />);

		await searchPeople('mi');

		expect((await screen.findByRole('button', { name: 'Remove Mia' })).props.accessibilityState).toMatchObject({
			selected: true,
		});
	});

	it('treats an invite the server already had as done', async () => {
		serve([], reply(409, { statusCode: 409, message: 'User is already a member of this room' }));
		await renderWithProviders(<InviteScreen />);
		await searchPeople('le');

		await fireEvent.press(await screen.findByRole('button', { name: 'Invite Leo' }));

		expect(await screen.findByRole('button', { name: 'Remove Leo' })).toBeTruthy();
		expect(screen.queryByText('Already done')).toBeNull();
	});

	it('takes an invite back with a second tap, and keeps the person listed', async () => {
		serve([{ id: 'm1', roomId: 'r1', userId: 'u2', user: MIA }]);
		await renderWithProviders(<InviteScreen />);

		await fireEvent.press(await screen.findByRole('button', { name: 'Remove Mia' }));

		await waitFor(() => expect(screen.getByText('Mia removed')).toBeTruthy());
		expect(screen.getByText('Invited (0)')).toBeTruthy();
		const removeCall = fetchMock.mock.calls.find(([, init]) => init.method === 'DELETE');
		expect(removeCall[0]).toContain('/rooms/r1/members/u2');

		await fireEvent.press(screen.getByRole('button', { name: 'Invite Mia' }));

		await waitFor(() => expect(screen.getByText('Invited (1)')).toBeTruthy());
		expect(fetchMock.mock.calls.filter(([, init]) => init.method === 'POST')).toHaveLength(1);
	});

	it('explains a refused invite', async () => {
		serve([], reply(403, { statusCode: 403, message: 'Only the owner can manage members' }));
		await renderWithProviders(<InviteScreen />);
		await searchPeople('le');

		await fireEvent.press(await screen.findByRole('button', { name: 'Invite Leo' }));

		await waitFor(() => expect(screen.getByText('Only the owner can manage members.')).toBeTruthy());
	});
});

describe('Now playing', () => {
	let fetchMock: jest.Mock;
	let socket: FakeSocket;
	const player = (Audio as unknown as { testPlayer: Record<string, jest.Mock> }).testPlayer;
	const TRACKS = [
		{ id: 't1', providerId: '111', title: 'Midnight City', artist: 'M83', score: 12, position: null },
		{ id: 't2', providerId: '222', title: 'Electric Feel', artist: 'MGMT', score: 9, position: null },
	];
	const DEEZER = { preview: 'https://cdn/fresh.mp3', album: { cover_medium: 'https://cdn/cover.jpg' } };
	const secondsAgo = (seconds: number) => new Date(Date.now() - seconds * 1000).toISOString();

	beforeEach(async () => {
		await AsyncStorage.clear();
		await tokenStorage.clear();
		process.env.EXPO_PUBLIC_API_URL = SERVER;
		fetchMock = mockFetch();
		socket = new FakeSocket();
		socket.connected = true;
		Object.values(player).forEach((fn) => fn.mockClear());
		(useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'r1' });
	});

	function serve(room: object, routes: Record<string, unknown> = {}) {
		routeFetch(fetchMock, {
			'/users/me': reply(200, ME),
			'/rooms/r1': reply(200, { ...VOTE_ROOM, currentTrackId: null, currentTrackStartedAt: null, ...room }),
			'/rooms/r1/tracks': reply(200, TRACKS),
			'/track/111': reply(200, DEEZER),
			'/track/222': reply(200, { ...DEEZER, preview: 'https://cdn/fresh-2.mp3' }),
			...routes,
		});
	}

	const renderRoom = () =>
		renderWithProviders(
			<SocketContext.Provider value={{ socket: socket as never, connected: true }}>
				<RoomScreen />
			</SocketContext.Provider>,
		);

	it('plays the current track on this phone, and keeps it out of the queue', async () => {
		serve({ currentTrackId: 't1', currentTrackStartedAt: secondsAgo(10) });

		await renderRoom();

		await waitFor(() => expect(player.replace).toHaveBeenCalledWith({ uri: 'https://cdn/fresh.mp3' }));
		expect(player.play).toHaveBeenCalled();
		expect(screen.getByLabelText('Now playing: Midnight City by M83')).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Vote for Midnight City' })).toBeNull();
		expect(screen.getByRole('button', { name: 'Vote for Electric Feel' })).toBeTruthy();
	});

	it('starts the new track on every phone when the room moves on', async () => {
		serve({});
		await renderRoom();
		await screen.findByText('Nothing playing yet. The owner starts the music.');

		await act(() => socket.serverSends('playback:next', { track: TRACKS[1], startedAt: secondsAgo(0) }));

		await waitFor(() => expect(player.replace).toHaveBeenCalledWith({ uri: 'https://cdn/fresh-2.mp3' }));
		expect(screen.getByLabelText('Now playing: Electric Feel by MGMT')).toBeTruthy();
	});

	it('lets the owner start the music, then move on', async () => {
		await tokenStorage.set('token', SERVER);
		let playing: object | null = null;
		serve({ ownerId: 'me' }, {});
		const base = fetchMock.getMockImplementation()!;
		fetchMock.mockImplementation(async (url: string, init: { method: string }) => {
			if (url.includes('/tracks/next')) {
				playing = playing ? { currentTrack: TRACKS[1], startedAt: secondsAgo(0) } : { currentTrack: TRACKS[0], startedAt: secondsAgo(0) };
				return reply(200, playing);
			}
			return base(url, init);
		});
		await renderRoom();

		await fireEvent.press(await screen.findByRole('button', { name: 'Start playing' }));
		expect(await screen.findByLabelText('Now playing: Midnight City by M83')).toBeTruthy();

		await fireEvent.press(screen.getByRole('button', { name: 'Next track' }));
		expect(await screen.findByLabelText('Now playing: Electric Feel by MGMT')).toBeTruthy();
		expect(fetchMock.mock.calls.filter(([url]) => url.includes('/tracks/next'))).toHaveLength(2);
	});

	it('leaves the music controls to the owner', async () => {
		serve({ currentTrackId: 't1', currentTrackStartedAt: secondsAgo(5) });

		await renderRoom();

		await screen.findByLabelText('Now playing: Midnight City by M83');
		expect(screen.queryByRole('button', { name: 'Next track' })).toBeNull();
	});

	it('mutes and unmutes this phone only', async () => {
		serve({ currentTrackId: 't1', currentTrackStartedAt: secondsAgo(5) });
		await renderRoom();
		await waitFor(() => expect(player.play).toHaveBeenCalled());

		await fireEvent.press(screen.getByRole('button', { name: 'Mute' }));
		expect(player.pause).toHaveBeenCalled();

		player.play.mockClear();
		await fireEvent.press(screen.getByRole('button', { name: 'Listen' }));
		expect(player.play).toHaveBeenCalled();
		expect(fetchMock.mock.calls.some(([url]) => url.includes('/tracks/next'))).toBe(false);
	});

	it('says when a track cannot be played', async () => {
		serve({ currentTrackId: 't1', currentTrackStartedAt: secondsAgo(5) }, { '/track/111': reply(500, {}) });

		await renderRoom();

		expect(await screen.findByText("This track can't be played right now.")).toBeTruthy();
	});
});
