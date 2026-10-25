import http from 'k6/http';
import { check } from 'k6';

export const options = {
	vus: 1,
	iterations: 1,
	thresholds: { checks: ['rate==1'] },
};

export default function () {
	const base = __ENV.BASE_URL || 'http://api-1:3000';
	const statuses = [];

	for (let i = 0; i < 20; i++) {
		const res = http.post(
			`${base}/auth/login`,
			JSON.stringify({ email: 'user1@test.com', password: 'wrong-password' }),
			{ headers: { 'Content-Type': 'application/json' } },
		);
		statuses.push(res.status);
	}

	console.log(statuses.join(' '));

	check(statuses, {
		'attempts 1-15 are 401': (s) => s.slice(0, 15).every((x) => x === 401),
		'attempts 16-20 are 429': (s) => s.slice(15).every((x) => x === 429),
	});
}
