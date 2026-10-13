// Shapes of the backend's answers (see /docs on the backend)

export type Tokens = {
	accessToken: string;
	refreshToken: string;
};

export type User = {
	id: string;
	email: string | null;
	emailVerified: boolean;
	displayName: string;
	role: 'USER' | 'ADMIN';
	bio: string | null;
	avatarUrl: string | null;
	location: string | null;
	phoneNumber: string | null;
	musicPreference: { genres?: string[] } | null;
	birthDate: string | null;
	createdAt: string;
	updatedAt: string;
};

export type RoomKind = 'VOTE' | 'PLAYLIST';
export type Visibility = 'PUBLIC' | 'PRIVATE';
export type AccessPolicy = 'OPEN' | 'INVITE_ONLY' | 'RESTRICTED';

export type Room = {
	id: string;
	name: string;
	description: string | null;
	kind: RoomKind;
	visibility: Visibility;
	accessPolicy: AccessPolicy;
	ownerId: string;
	locationLat: number | null;
	locationLng: number | null;
	locationRadiusM: number | null;
	windowStart: string | null;
	windowEnd: string | null;
	currentTrackId: string | null;
	createdAt: string;
	updatedAt: string;
};

export type Track = {
	id: string;
	roomId: string;
	provider: string;
	providerId: string;
	title: string;
	artist: string;
	durationMs: number | null;
	previewUrl: string | null;
	score: number;
	position: string | null;
	addedAt: string;
	playedAt: string | null;
};
