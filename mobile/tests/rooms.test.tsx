import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import AddTrackScreen from '@/app/(app)/rooms/add-track';
import NewRoomScreen from '@/app/(app)/rooms/new';
import RoomScreen from '@/app/(app)/rooms/[id]';
import { currentPosition, LocationError } from '@/lib/location';
import { emptyRoomForm, validateRoomForm, type RoomForm } from '@/rooms/roomForm';
import { tokenStorage } from '@/session/tokenStorage';
import { mockFetch, renderWithProviders, reply, routeFetch } from './helpers';

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

	it('sends the phone position in a place-and-time room', async () => {
		routeFetch(fetchMock, {
			'/rooms/r1': reply(200, { ...VOTE_ROOM, accessPolicy: 'RESTRICTED' }),
			'/rooms/r1/tracks': reply(200, VOTE_TRACKS),
		});

		await renderWithProviders(<RoomScreen />);

		await waitFor(() => expect(screen.getByText('Midnight City')).toBeTruthy());
		const tracksCall = fetchMock.mock.calls.find(([url]) => url.includes('/tracks'));
		expect(tracksCall[0]).toContain('?lat=13.7563&lng=100.5018');
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

	it('sends the position of a place-and-time room', async () => {
		(useLocalSearchParams as jest.Mock).mockReturnValue({ roomId: 'r1', kind: 'VOTE', lat: '13.75', lng: '100.5' });
		routeFetch(fetchMock, { '/rooms/r1/tracks/search': reply(200, RESULTS) });

		await search('daft punk');

		await waitFor(() => expect(fetchMock).toHaveBeenCalled());
		expect(fetchMock.mock.calls[0][0]).toContain('&lat=13.75&lng=100.5');
	});

	it('adds to a playlist with playlist words', async () => {
		(useLocalSearchParams as jest.Mock).mockReturnValue({ roomId: 'r1', kind: 'PLAYLIST' });
		routeFetch(fetchMock, { '/rooms/r1/tracks/search': reply(200, RESULTS) });

		await search('daft punk');

		expect(screen.getByRole('header', { name: 'Add a track' })).toBeTruthy();
		expect(await screen.findByRole('button', { name: 'Add One More Time by Daft Punk' })).toBeTruthy();
	});
});
