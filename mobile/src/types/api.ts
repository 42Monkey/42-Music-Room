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

// Someone else's profile: public part, plus location and phone for friends only
export type Profile = {
	id: string;
	displayName: string;
	bio: string | null;
	avatarUrl: string | null;
	musicPreference: { genres?: string[] } | null;
	location?: string | null;
	phoneNumber?: string | null;
};

// What the user can change on their own profile (birthDate: 'YYYY-MM-DD')
export type ProfileChanges = Partial<
	Pick<User, 'displayName' | 'bio' | 'avatarUrl' | 'location' | 'phoneNumber' | 'musicPreference' | 'birthDate'>
>;

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
	// When the current track started, shared by every phone in the room
	currentTrackStartedAt: string | null;
	createdAt: string;
	updatedAt: string;
	// Invited people (sent with a single room)
	members?: { userId: string }[];
};

// Body of POST /rooms
export type CreateRoomInput = {
	name: string;
	description?: string;
	kind: RoomKind;
	visibility: Visibility;
	accessPolicy: AccessPolicy;
	locationLat?: number;
	locationLng?: number;
	locationRadiusM?: number;
	windowStart?: string;
	windowEnd?: string;
};

export type Position = {
	lat: number;
	lng: number;
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
	// Only in the list loaded by this user, not in live updates
	votedByMe?: boolean;
};

// What a room plays: from POST /tracks/next and the live playback:next event
export type Playback = {
	track: Track | null;
	startedAt: string | null;
};

// One Deezer search result (not in a room yet)
export type TrackResult = {
	providerId: string;
	title: string;
	artist: string;
	durationMs: number;
	previewUrl: string | null;
	albumCoverUrl: string | null;
};

// Someone found in a search (no private details)
export type UserSummary = {
	id: string;
	displayName: string;
	avatarUrl: string | null;
};

// One invited person of a room
export type RoomMember = {
	id: string;
	roomId: string;
	userId: string;
	user: UserSummary;
};
