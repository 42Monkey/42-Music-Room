import { api, configureApi } from '@/api/client';
import { ApiError, NetworkError } from '@/api/errors';
import { createRoom, getRoom } from '@/api/rooms';
import { inviteMember, listMembers, removeMember } from '@/api/members';
import { searchUsers } from '@/api/users';
import { login, register, requestPasswordReset, resendVerification, resetPassword, verifyEmail } from '@/api/auth';
import { addTrack, listTracks, nextTrack, removeTrack, reorderTrack, searchTracks, unvoteTrack, voteTrack } from '@/api/tracks';
import { freshPreview } from '@/lib/deezer';
import { failure, mockFetch, reply } from './helpers';

const onUnauthorized = jest.fn();
let fetchMock: jest.Mock;

function sentHeaders(): Record<string, string> {
	return fetchMock.mock.calls[0][1].headers;
}

beforeEach(() => {
	fetchMock = mockFetch();
	onUnauthorized.mockReset();
	configureApi({ baseUrl: 'http://10.0.0.5:8080/', token: null, onUnauthorized, renew: null, timeoutMs: 50 });
});

describe('api client', () => {
	it('calls the backend address joined with the path', async () => {
		fetchMock.mockResolvedValue(reply(200, []));

		await api.get('/rooms');

		expect(fetchMock.mock.calls[0][0]).toBe('http://10.0.0.5:8080/rooms');
	});

	it('sends the session token when logged in', async () => {
		configureApi({ token: 'abc' });
		fetchMock.mockResolvedValue(reply(200, {}));

		await api.get('/users/me');

		expect(sentHeaders().Authorization).toBe('Bearer abc');
	});

	it('sends no token when logged out', async () => {
		fetchMock.mockResolvedValue(reply(200, {}));

		await api.get('/health');

		expect(sentHeaders().Authorization).toBeUndefined();
	});

	it('sends platform, device and app version on every request', async () => {
		fetchMock.mockResolvedValue(reply(200, {}));

		await api.get('/health');

		expect(sentHeaders()['x-platform']).toBe('ios');
		expect(sentHeaders()['x-device']).toEqual(expect.any(String));
		expect(sentHeaders()['x-app-version']).toEqual(expect.any(String));
	});

	it('sends the body as JSON', async () => {
		fetchMock.mockResolvedValue(reply(201, { id: '1' }));

		await api.post('/rooms', { name: 'Party' });

		const init = fetchMock.mock.calls[0][1];
		expect(init.method).toBe('POST');
		expect(init.headers['Content-Type']).toBe('application/json');
		expect(init.body).toBe(JSON.stringify({ name: 'Party' }));
	});

	it('returns the parsed answer', async () => {
		fetchMock.mockResolvedValue(reply(200, [{ id: 'r1' }]));

		await expect(api.get('/rooms')).resolves.toEqual([{ id: 'r1' }]);
	});

	it('returns null when the answer is empty', async () => {
		fetchMock.mockResolvedValue(reply(200));

		await expect(api.delete('/rooms/r1/tracks/t1')).resolves.toBeNull();
	});

	it('throws the server message when the backend refuses', async () => {
		fetchMock.mockResolvedValue(reply(403, { statusCode: 403, message: 'This room is invite-only' }));

		const error = await failure(api.get('/rooms/r1/tracks'));

		expect(error).toBeInstanceOf(ApiError);
		expect(error.status).toBe(403);
		expect(error.serverMessage).toBe('This room is invite-only');
	});

	it('signs out when the session token is refused', async () => {
		configureApi({ token: 'expired' });
		fetchMock.mockResolvedValue(reply(401, { statusCode: 401, message: 'Unauthorized' }));

		await expect(api.get('/rooms')).rejects.toBeInstanceOf(ApiError);
		expect(onUnauthorized).toHaveBeenCalledTimes(1);
	});

	it('does not sign out on a refused login', async () => {
		fetchMock.mockResolvedValue(reply(401, { statusCode: 401, message: 'Invalid credentials' }));

		await expect(api.post('/auth/login', {})).rejects.toBeInstanceOf(ApiError);
		expect(onUnauthorized).not.toHaveBeenCalled();
	});

	it('reports an unreachable server', async () => {
		fetchMock.mockRejectedValue(new TypeError('Network request failed'));

		const error = await failure(api.get('/rooms'));

		expect(error).toBeInstanceOf(NetworkError);
		expect(error.reason).toBe('unreachable');
		expect(error.address).toBe('http://10.0.0.5:8080');
	});

	it('gives up on a server that never answers', async () => {
		fetchMock.mockImplementation(
			(_url: string, init: { signal: AbortSignal }) =>
				new Promise((_resolve, reject) => {
					init.signal.addEventListener('abort', () => reject(new Error('Aborted')));
				}),
		);

		const error = await failure(api.get('/rooms'));

		expect(error).toBeInstanceOf(NetworkError);
		expect(error.reason).toBe('timeout');
	});

	it('creates a room', async () => {
		fetchMock.mockResolvedValue(reply(201, { id: 'r9', name: 'Party' }));

		const room = await createRoom({ name: 'Party', kind: 'VOTE', visibility: 'PUBLIC', accessPolicy: 'OPEN' });

		expect(fetchMock.mock.calls[0][0]).toBe('http://10.0.0.5:8080/rooms');
		expect(fetchMock.mock.calls[0][1].method).toBe('POST');
		expect(room.id).toBe('r9');
	});

	it('loads one room', async () => {
		fetchMock.mockResolvedValue(reply(200, { id: 'r1' }));

		await getRoom('r1');

		expect(fetchMock.mock.calls[0][0]).toBe('http://10.0.0.5:8080/rooms/r1');
	});

	it('sends the phone position with the track list when given', async () => {
		fetchMock.mockResolvedValue(reply(200, []));

		await listTracks('r1', { lat: 13.75, lng: 100.5 });

		expect(fetchMock.mock.calls[0][0]).toBe('http://10.0.0.5:8080/rooms/r1/tracks?lat=13.75&lng=100.5');
	});

	it('searches Deezer through the room, with the position when given', async () => {
		fetchMock.mockResolvedValue(reply(200, []));

		await searchTracks('r1', 'daft punk & co', { lat: 13.75, lng: 100.5 });

		expect(fetchMock.mock.calls[0][0]).toBe(
			'http://10.0.0.5:8080/rooms/r1/tracks/search?query=daft%20punk%20%26%20co&lat=13.75&lng=100.5',
		);
	});

	it('adds a track by its Deezer id', async () => {
		fetchMock.mockResolvedValue(reply(201, { id: 't9' }));

		await addTrack('r1', '3135556');

		expect(fetchMock.mock.calls[0][0]).toBe('http://10.0.0.5:8080/rooms/r1/tracks');
		expect(fetchMock.mock.calls[0][1].method).toBe('POST');
		expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ deezerTrackId: '3135556' });
	});

	it('votes and takes a vote back', async () => {
		fetchMock.mockResolvedValue(reply(201, {}));

		await voteTrack('r1', 't1', { lat: 13.75, lng: 100.5 });
		await unvoteTrack('r1', 't1');

		expect(fetchMock.mock.calls[0][0]).toBe('http://10.0.0.5:8080/rooms/r1/tracks/t1/vote?lat=13.75&lng=100.5');
		expect(fetchMock.mock.calls[0][1].method).toBe('POST');
		expect(fetchMock.mock.calls[1][0]).toBe('http://10.0.0.5:8080/rooms/r1/tracks/t1/vote');
		expect(fetchMock.mock.calls[1][1].method).toBe('DELETE');
	});

	it('moves a track after another one, or to the top', async () => {
		fetchMock.mockResolvedValue(reply(200, {}));

		await reorderTrack('r1', 't3', 't1');
		await reorderTrack('r1', 't3', null);

		expect(fetchMock.mock.calls[0][0]).toBe('http://10.0.0.5:8080/rooms/r1/tracks/t3/position');
		expect(fetchMock.mock.calls[0][1].method).toBe('PATCH');
		expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ afterTrackId: 't1' });
		expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ afterTrackId: null });
	});

	it('removes a track', async () => {
		fetchMock.mockResolvedValue(reply(200, {}));

		await removeTrack('r1', 't3');

		expect(fetchMock.mock.calls[0][0]).toBe('http://10.0.0.5:8080/rooms/r1/tracks/t3');
		expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
	});

	it('moves the room to its next track', async () => {
		fetchMock.mockResolvedValue(reply(200, { currentTrack: null, startedAt: null }));

		await nextTrack('r1');

		expect(fetchMock.mock.calls[0][0]).toBe('http://10.0.0.5:8080/rooms/r1/tracks/next');
		expect(fetchMock.mock.calls[0][1].method).toBe('POST');
	});

	it('gets a fresh preview link and cover straight from Deezer', async () => {
		fetchMock.mockResolvedValue(reply(200, { preview: 'https://cdn/p.mp3?exp=1', album: { cover_medium: 'https://cdn/c.jpg' } }));

		const preview = await freshPreview('3135556');

		expect(fetchMock.mock.calls[0][0]).toBe('https://api.deezer.com/track/3135556');
		expect(preview).toEqual({ previewUrl: 'https://cdn/p.mp3?exp=1', coverUrl: 'https://cdn/c.jpg' });
	});

	it('fails when Deezer has no preview for a track', async () => {
		fetchMock.mockResolvedValue(reply(200, { error: { type: 'DataException', message: 'no data' } }));

		const error = await failure(freshPreview('0'));

		expect(error).toBeInstanceOf(Error);
	});

	it('finds people by name or email', async () => {
		fetchMock.mockResolvedValue(reply(200, []));

		await searchUsers('mia k');

		expect(fetchMock.mock.calls[0][0]).toBe('http://10.0.0.5:8080/users?search=mia%20k');
	});

	it('lists the members of a room and invites one', async () => {
		fetchMock.mockResolvedValue(reply(201, {}));

		await listMembers('r1');
		await inviteMember('r1', 'u2');

		expect(fetchMock.mock.calls[0][0]).toBe('http://10.0.0.5:8080/rooms/r1/members');
		expect(fetchMock.mock.calls[1][0]).toBe('http://10.0.0.5:8080/rooms/r1/members');
		expect(fetchMock.mock.calls[1][1].method).toBe('POST');
		expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ userId: 'u2' });
	});

	it('removes someone from a room', async () => {
		fetchMock.mockResolvedValue(reply(200, {}));

		await removeMember('r1', 'u2');

		expect(fetchMock.mock.calls[0][0]).toBe('http://10.0.0.5:8080/rooms/r1/members/u2');
		expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
	});

	it('renews an expired login once, then retries the call', async () => {
		const renew = jest.fn(async () => {
			configureApi({ token: 'fresh' });
			return 'fresh';
		});
		configureApi({ token: 'expired', renew });
		fetchMock.mockResolvedValueOnce(reply(401, { statusCode: 401, message: 'Unauthorized' }));
		fetchMock.mockResolvedValueOnce(reply(200, { id: 'u1' }));

		const me = await api.get<{ id: string }>('/users/me');

		expect(me.id).toBe('u1');
		expect(renew).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer fresh');
		expect(onUnauthorized).not.toHaveBeenCalled();
	});

	it('ends the session when the login cannot be renewed', async () => {
		configureApi({ token: 'expired', renew: async () => null });
		fetchMock.mockResolvedValue(reply(401, { statusCode: 401, message: 'Unauthorized' }));

		const error = await failure(api.get('/users/me'));

		expect(error.status).toBe(401);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(onUnauthorized).toHaveBeenCalledTimes(1);
	});

	it('does not renew for the renewal call itself', async () => {
		const renew = jest.fn(async () => 'fresh');
		configureApi({ token: 'expired', renew });
		fetchMock.mockResolvedValue(reply(401, { statusCode: 401, message: 'Invalid refresh token' }));

		await failure(api.post('/auth/refresh', { refreshToken: 'old' }));

		expect(renew).not.toHaveBeenCalled();
		expect(onUnauthorized).not.toHaveBeenCalled();
	});

	it('refuses to call without a server address', async () => {
		configureApi({ baseUrl: '' });

		const error = await failure(api.get('/rooms'));

		expect(error).toBeInstanceOf(NetworkError);
		expect(error.reason).toBe('no-address');
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe('auth api', () => {
	it('logs in with email and password and returns the tokens', async () => {
		const tokens = { accessToken: 'a', refreshToken: 'r' };
		fetchMock.mockResolvedValue(reply(200, tokens));

		const answer = await login('mia@test.com', 'secret123');

		expect(fetchMock.mock.calls[0][0]).toBe('http://10.0.0.5:8080/auth/login');
		expect(fetchMock.mock.calls[0][1].method).toBe('POST');
		expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: 'mia@test.com', password: 'secret123' });
		expect(answer).toEqual(tokens);
	});

	it('fails with the server message when the email is not verified', async () => {
		fetchMock.mockResolvedValue(reply(403, { statusCode: 403, message: 'Verify your email before logging in' }));

		const error = await failure(login('mia@test.com', 'secret123'));

		expect(error).toBeInstanceOf(ApiError);
		expect(error.status).toBe(403);
		expect(error.message).toBe('Verify your email before logging in');
	});

	it('creates an account', async () => {
		const input = { email: 'mia@test.com', password: 'secret123', displayName: 'Mia' };
		fetchMock.mockResolvedValue(reply(201, { id: 'u1', email: 'mia@test.com', displayName: 'Mia' }));

		const user = await register(input);

		expect(fetchMock.mock.calls[0][0]).toBe('http://10.0.0.5:8080/auth/register');
		expect(fetchMock.mock.calls[0][1].method).toBe('POST');
		expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(input);
		expect(user.id).toBe('u1');
	});

	it('asks for a password reset code', async () => {
		fetchMock.mockResolvedValue(reply(200, { message: 'If that email exists, a reset link has been sent.' }));

		await requestPasswordReset('mia@test.com');

		expect(fetchMock.mock.calls[0][0]).toBe('http://10.0.0.5:8080/auth/request-password-reset');
		expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: 'mia@test.com' });
	});

	it('sets a new password with the code', async () => {
		const input = { email: 'mia@test.com', token: '123456', newPassword: 'newsecret1' };
		fetchMock.mockResolvedValue(reply(200, { message: 'Password reset successfully' }));

		await resetPassword(input);

		expect(fetchMock.mock.calls[0][0]).toBe('http://10.0.0.5:8080/auth/reset-password');
		expect(fetchMock.mock.calls[0][1].method).toBe('POST');
		expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(input);
	});

	it('checks the email code, with both values encoded', async () => {
		fetchMock.mockResolvedValue(reply(200, { message: 'Email verified succesfully' }));

		await verifyEmail('mia+music@test.com', '123456');

		expect(fetchMock.mock.calls[0][0]).toBe(
			'http://10.0.0.5:8080/auth/verify-email?email=mia%2Bmusic%40test.com&token=123456',
		);
		expect(fetchMock.mock.calls[0][1].method).toBe('GET');
	});

	it('asks for a new email code', async () => {
		fetchMock.mockResolvedValue(reply(200, {}));

		await resendVerification('mia@test.com');

		expect(fetchMock.mock.calls[0][0]).toBe('http://10.0.0.5:8080/auth/resend-verification');
		expect(fetchMock.mock.calls[0][1].method).toBe('POST');
		expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: 'mia@test.com' });
	});
});
