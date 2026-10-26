// Deezer's public API, called straight from the phone (no key needed)
const DEEZER = 'https://api.deezer.com';

export type Preview = {
	previewUrl: string;
	coverUrl: string | null;
};

// Preview links expire after a few minutes: get a fresh one right before playing
export async function freshPreview(providerId: string): Promise<Preview> {
	const response = await fetch(`${DEEZER}/track/${providerId}`);
	const text = response.ok ? await response.text() : '';
	const data = text ? JSON.parse(text) : null;
	if (!data?.preview) throw new Error('No preview for this track');
	return { previewUrl: data.preview, coverUrl: data.album?.cover_medium ?? null };
}
