const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
const MID_CHAR = ALPHABET[Math.floor(ALPHABET.length / 2)]; // 'm'

export function handlePositionBetween(before: string | null, after: string | null): string {
	if (!before && !after) {
		return MID_CHAR;
	}

	if (!before) {
		return midpoint('', after!);
	}

	if (!after) {
		return midpoint(before, '');
	}

	return midpoint(before, after);
}

function midpoint(low: string, high: string): string {
	let result = '';
	let i = 0;

	while (true) {
		let lowChar = 0;
		if (i < low.length) {
			lowChar = low.charCodeAt(i) - 97; // 'a' = 0
		}

		let highChar = 26;
		if (i < high.length) {
			highChar = high.charCodeAt(i) - 97; // past-end = 26
		}

		if (highChar - lowChar > 1) {
			const mid = lowChar + Math.floor((highChar - lowChar) / 2);
			result += ALPHABET[mid];
			return result;
		}

		result += ALPHABET[lowChar];
		i++;
	}
}
