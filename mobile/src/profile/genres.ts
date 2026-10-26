// Genres to pick from on the profile, saved in lowercase like the seed data
export const GENRES = [
	'pop',
	'rock',
	'hip-hop',
	'r&b',
	'electronic',
	'techno',
	'house',
	'jazz',
	'blues',
	'soul',
	'funk',
	'classical',
	'reggae',
	'metal',
	'indie',
	'folk',
	'country',
	'latin',
	'k-pop',
	'afrobeats',
];

const LABELS: Record<string, string> = {
	'hip-hop': 'Hip-hop',
	'r&b': 'R&B',
	'k-pop': 'K-pop',
};

// "jazz" -> "Jazz", with the few that need their own spelling
export function genreLabel(genre: string): string {
	return LABELS[genre] ?? genre.charAt(0).toUpperCase() + genre.slice(1);
}

// The list, plus any genre the user already has that is not in it (saved by an older version)
export function genreChoices(current: string[]): string[] {
	return [...GENRES, ...current.filter((genre) => !GENRES.includes(genre))];
}
