// [a, b, c] moving 0 to 2 -> [b, c, a]
export function moveItem<T>(items: T[], from: number, to: number): T[] {
	const next = [...items];
	const [item] = next.splice(from, 1);
	next.splice(to, 0, item);
	return next;
}

// Puts one item right after another (afterId null: first)
export function placeAfter<T extends { id: string }>(items: T[], id: string, afterId: string | null): T[] {
	const item = items.find((entry) => entry.id === id);
	if (!item) return items;
	const rest = items.filter((entry) => entry.id !== id);
	const at = afterId === null ? 0 : rest.findIndex((entry) => entry.id === afterId) + 1;
	return [...rest.slice(0, at), item, ...rest.slice(at)];
}

export type Places = Record<string, number>;

// Same move on a map of id -> place, run on the UI thread while dragging
export function movePlace(places: Places, id: string, to: number): Places {
	'worklet';
	const from = places[id];
	const next: Places = {};
	for (const key in places) {
		const place = places[key];
		if (key === id) next[key] = to;
		else if (from < to && place > from && place <= to) next[key] = place - 1;
		else if (from > to && place < from && place >= to) next[key] = place + 1;
		else next[key] = place;
	}
	return next;
}
