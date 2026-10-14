import type { AccessPolicy, CreateRoomInput, Position, RoomKind, Visibility } from '@/types/api';

export type RoomForm = {
	name: string;
	description: string;
	kind: RoomKind;
	visibility: Visibility;
	license: AccessPolicy;
	position: Position | null;
	radiusM: number;
	start: Date;
	end: Date;
};

export type RoomFormErrors = {
	name?: string;
	position?: string;
	time?: string;
};

export type RoomFormResult = { ok: true; input: CreateRoomInput } | { ok: false; errors: RoomFormErrors };

const atTime = (day: Date, hours: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, 0);

// Starting values: public, everyone can vote, 20:00 to 02:00 if limited
export function emptyRoomForm(today = new Date()): RoomForm {
	return {
		name: '',
		description: '',
		kind: 'VOTE',
		visibility: 'PUBLIC',
		license: 'OPEN',
		position: null,
		radiusM: 300,
		start: atTime(today, 20),
		end: atTime(today, 2),
	};
}

// Today's opening and closing times, closing the next day after midnight
function timeWindow(start: Date, end: Date, today: Date) {
	const open = new Date(today.getFullYear(), today.getMonth(), today.getDate(), start.getHours(), start.getMinutes());
	const close = new Date(today.getFullYear(), today.getMonth(), today.getDate(), end.getHours(), end.getMinutes());
	if (close <= open) close.setDate(close.getDate() + 1);
	return { open, close };
}

// Checks the form and builds the body for POST /rooms
export function validateRoomForm(form: RoomForm, today = new Date()): RoomFormResult {
	const errors: RoomFormErrors = {};
	const name = form.name.trim();
	if (!name) errors.name = 'Give the room a name.';
	else if (name.length > 100) errors.name = 'Keep the name under 100 characters.';

	const restricted = form.license === 'RESTRICTED';
	if (restricted && !form.position) errors.position = 'Set the room\'s place with "Use my current location".';
	const sameTime =
		form.start.getHours() === form.end.getHours() && form.start.getMinutes() === form.end.getMinutes();
	if (restricted && sameTime) errors.time = 'The room must open and close at different times.';

	if (Object.keys(errors).length > 0) return { ok: false, errors };

	const input: CreateRoomInput = {
		name,
		kind: form.kind,
		visibility: form.visibility,
		accessPolicy: form.license,
	};
	const description = form.description.trim();
	if (description) input.description = description;

	// Place and time only for rooms limited to them
	if (restricted && form.position) {
		const { open, close } = timeWindow(form.start, form.end, today);
		input.locationLat = form.position.lat;
		input.locationLng = form.position.lng;
		input.locationRadiusM = form.radiusM;
		input.windowStart = open.toISOString();
		input.windowEnd = close.toISOString();
	}
	return { ok: true, input };
}
