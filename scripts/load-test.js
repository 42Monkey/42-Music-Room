import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Counter } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

// Metrics
const failedRequests = new Rate('failed_requests');
const hardFailures = new Rate('hard_failures');
const setupLoginFailures = new Counter('setup_login_failures');

// Config
const BASE_URL = __ENV.BASE_URL || 'http://api-1:3000';
const NUM_SEEDED_USERS = Number(__ENV.NUM_SEEDED_USERS || 50);
const SEED_PASSWORD = __ENV.SEED_PASSWORD || 'password123';
const ROOM_KIND = __ENV.ROOM_KIND || 'VOTE';

export const options = {
	stages: [
		{ duration: '20s', target: 50 },	// Warm-up
		{ duration: '40s', target: 250 },	// Moderate load
		{ duration: '40s', target: 400 },	// High stress test
		{ duration: '20s', target: 0 },		// Ramp down
	],
	thresholds: {
		http_req_duration: ['p(95)<2000'],
		failed_requests: ['rate<0.05'],
		hard_failures: ['rate<0.01'],
		setup_login_failures: ['count==0'],
	},
	summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

function isServerError(res) {
	return res.status === 0 || res.status >= 500;
}

function record(res, checkName, expectedStatuses) {
	const ok = expectedStatuses.includes(res.status);
	const success = check(res, { [checkName]: () => ok });
	failedRequests.add(!success);
	hardFailures.add(isServerError(res));
	return ok;
}

function safeJson(res) {
	try {
		return JSON.parse(res.body);
	} catch (e) {
		return null;
	}
}

// Setup
export function setup() {
	const sampleIndices = [1, Math.ceil(NUM_SEEDED_USERS / 2), NUM_SEEDED_USERS];
	const failures = [];

	for (const i of new Set(sampleIndices)) {
		const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
			email: `user${i}@test.com`,
			password: SEED_PASSWORD,
		}), {
			headers: { 'Content-Type': 'application/json' },
			tags: { name: 'POST /auth/login (setup)' }
		});

		if (res.status !== 200 && res.status !== 201) {
			failures.push(`user${i}@test.com (status ${res.status})`);
		}
	}

	if (failures.length > 0) {
		setupLoginFailures.add(failures.length);
		throw new Error(
			`Setup check failed: could not log in as ${failures.join(', ')}. ` +
			`This script assumes user1@test.com..user${NUM_SEEDED_USERS}@test.com / ` +
			`${SEED_PASSWORD} are already seeded in the target DB.`,
		);
	}

	return { baseUrl: BASE_URL };
}

function jitter(baseSeconds) {
	sleep(baseSeconds * (0.5 + Math.random()));
}

// Per-VU state
const authTokens = {};

export default function (data) {
	const BASE = data.baseUrl;
	let roomId = null;
	let trackId = null;
	const vuId = __VU;
	const targetUserId = ((vuId % NUM_SEEDED_USERS) + 1);

	if (!authTokens[vuId]) {
		loginForVu(vuId, BASE);
	}

	jitter(1);

	if (authTokens[vuId]) {
		const authHeaders = {
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${authTokens[vuId]}`,
			},
		};

		const peerUserId = ((targetUserId % NUM_SEEDED_USERS) + 1);

		runHealthCheck(BASE);
		runUsersAndProfiles(BASE, authHeaders, targetUserId);
		runFriendsFlow(BASE, authHeaders, peerUserId);
		roomId = runRoomsLifecycle(BASE, authHeaders, vuId, roomId);
		runRoomDeletionScratch(BASE, authHeaders, vuId);

		jitter(1);

		if (roomId) {
			runRoomMembers(BASE, authHeaders, roomId, targetUserId);
		}
		if (roomId) {
			trackId = runTracksAndQueue(BASE, authHeaders, roomId, trackId);
		}
		runAdminGuardCheck(BASE, authHeaders);
	}

	jitter(2);
}

function loginForVu(vuId, BASE) {
	group('Auth - Login', function () {
		const userIndex = ((vuId - 1) % NUM_SEEDED_USERS) + 1;
		const res = http.post(`${BASE}/auth/login`, JSON.stringify({
			email: `user${userIndex}@test.com`,
			password: SEED_PASSWORD,
		}), {
			headers: { 'Content-Type': 'application/json' },
			tags: { name: 'POST /auth/login' }
		});

		const ok = record(res, 'login success', [200, 201]);

		if (ok) {
			const body = safeJson(res);
			const token = body && (body.accessToken || body.access_token);
			if (token) {
				authTokens[vuId] = token;
			} else {
				hardFailures.add(true);
			}
		}
	});
}

function runHealthCheck(BASE) {
	group('Health Check', function () {
		const res = http.get(`${BASE}/health`, { tags: { name: 'GET /health' } });
		record(res, 'health status 200', [200]);
	});
}

function runUsersAndProfiles(BASE, authHeaders, targetUserId) {
	group('Users & Profiles', function () {
		record(
			http.get(`${BASE}/auth/me`, { ...authHeaders, tags: { name: 'GET /auth/me' } }),
			'auth/me 200',
			[200]
		);
		record(
			http.get(`${BASE}/users/me`, { ...authHeaders, tags: { name: 'GET /users/me' } }),
			'users/me 200',
			[200]
		);
		record(
			http.get(`${BASE}/users/${targetUserId}`, { ...authHeaders, tags: { name: 'GET /users/:id' } }),
			'get user by id valid status',
			[200, 404],
		);
		record(
			http.patch(`${BASE}/users/me`, JSON.stringify({ displayName: `Load Test ${targetUserId}` }), { ...authHeaders, tags: { name: 'PATCH /users/me' } }),
			'update own profile status valid',
			[200, 400],
		);
	});
}

function runFriendsFlow(BASE, authHeaders, peerUserId) {
	group('Friends Flow', function () {
		record(
			http.get(`${BASE}/friends`, { ...authHeaders, tags: { name: 'GET /friends' } }),
			'friends list 200',
			[200]
		);

		record(
			http.post(`${BASE}/friends/request`, JSON.stringify({ receiverId: peerUserId }), { ...authHeaders, tags: { name: 'POST /friends/request' } }),
			'friend request status valid',
			[200, 201, 400, 409],
		);

		record(
			http.post(`${BASE}/friends/${peerUserId}/accept`, null, { ...authHeaders, tags: { name: 'POST /friends/:id/accept' } }),
			'accept friend status valid',
			[201, 404, 409],
		);

		record(
			http.del(`${BASE}/friends/${peerUserId}`, null, { ...authHeaders, tags: { name: 'DELETE /friends/:id' } }),
			'delete friend status valid',
			[200, 204, 404],
		);
	});
}

function newRoomPayload(vuId) {
	return {
		name: `Room VU ${vuId}-${Date.now()}`.slice(0, 100),
		kind: ROOM_KIND,
		visibility: 'PUBLIC',
	};
}

function runRoomsLifecycle(BASE, authHeaders, vuId, roomId) {
	group('Rooms Lifecycle', function () {
		const listRes = http.get(`${BASE}/rooms`, { ...authHeaders, tags: { name: 'GET /rooms' } });
		record(listRes, 'list rooms 200', [200]);
		if (listRes.status === 200) {
			const rooms = safeJson(listRes);
			if (Array.isArray(rooms) && rooms.length > 0) {
				roomId = rooms[vuId % rooms.length].id;
			}
		}

		const createRes = http.post(`${BASE}/rooms`, JSON.stringify(newRoomPayload(vuId)), { ...authHeaders, tags: { name: 'POST /rooms' } });
		record(createRes, 'create room status valid', [201, 409]);
		if (createRes.status === 201) {
			const body = safeJson(createRes);
			if (body && body.id) {
				roomId = body.id;
			}
		}

		if (roomId) {
			record(
				http.get(`${BASE}/rooms/${roomId}`, { ...authHeaders, tags: { name: 'GET /rooms/:id' } }),
				'get room by id 200',
				[200]
			);
			record(
				http.patch(`${BASE}/rooms/${roomId}`, JSON.stringify({
					name: `Updated Room VU ${vuId}`,
				}), { ...authHeaders, tags: { name: 'PATCH /rooms/:id' } }),
				'update room 200',
				[200],
			);
		}
	});
	return roomId;
}

function runRoomDeletionScratch(BASE, authHeaders, vuId) {
	group('Room Deletion', function () {
		const createRes = http.post(`${BASE}/rooms`, JSON.stringify(newRoomPayload(vuId)), { ...authHeaders, tags: { name: 'POST /rooms (scratch)' } });
		if (createRes.status !== 201) {
			record(createRes, 'scratch room create status valid', [201, 409]);
			return;
		}
		const body = safeJson(createRes);
		const scratchRoomId = body && body.id;
		if (!scratchRoomId) return;

		record(
			http.del(`${BASE}/rooms/${scratchRoomId}`, null, { ...authHeaders, tags: { name: 'DELETE /rooms/:id' } }),
			'delete room status valid',
			[200, 204, 403, 404],
		);
	});
}

function runRoomMembers(BASE, authHeaders, roomId, targetUserId) {
	group('Room Members', function () {
		record(
			http.get(`${BASE}/rooms/${roomId}/members`, { ...authHeaders, tags: { name: 'GET /rooms/:roomId/members' } }),
			'list members 200',
			[200]
		);

		record(
			http.post(`${BASE}/rooms/${roomId}/members`, JSON.stringify({ userId: targetUserId }), { ...authHeaders, tags: { name: 'POST /rooms/:roomId/members' } }),
			'invite member status valid',
			[201, 400, 409],
		);

		record(
			http.del(`${BASE}/rooms/${roomId}/members/${targetUserId}`, null, { ...authHeaders, tags: { name: 'DELETE /rooms/:roomId/members/:userId' } }),
			'remove member status valid',
			[200, 204, 404],
		);
	});
}

function runTracksAndQueue(BASE, authHeaders, roomId, trackId) {
	group('Tracks & Queue', function () {
		const queueRes = http.get(`${BASE}/rooms/${roomId}/tracks`, { ...authHeaders, tags: { name: 'GET /rooms/:roomId/tracks' } });
		record(queueRes, 'get queue 200', [200]);
		if (queueRes.status === 200) {
			const queue = safeJson(queueRes);
			if (Array.isArray(queue) && queue.length > 0) {
				trackId = queue[0].id;
			}
		}

		record(
			http.post(`${BASE}/rooms/${roomId}/tracks/next`, null, { ...authHeaders, tags: { name: 'POST /rooms/:roomId/tracks/next' } }),
			'next track status valid',
			[201, 400, 404],
		);
	});
	return trackId;
}

function runAdminGuardCheck(BASE, authHeaders) {
	group('Admin Guards', function () {
		record(
			http.get(`${BASE}/logs`, { ...authHeaders, tags: { name: 'GET /logs' } }),
			'non-admin blocked from logs (403)',
			[403],
		);
	});
}

// Summary
export function handleSummary(data) {
	return {
		stdout: textSummary(data, { indent: ' ', enableColors: true }),
		'summary.json': JSON.stringify(data, null, 2),
	};
}
