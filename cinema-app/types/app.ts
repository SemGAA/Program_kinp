export type MediaType = 'movie' | 'tv';
export type SearchSourceKind =
  | 'catalog'
  | 'youtube'
  | 'direct'
  | 'external'
  | 'jellyfin'
  | 'shikimori'
  | 'internet_archive';

export type AuthUser = {
  avatarTheme: string;
  avatarUrl: string | null;
  bio: string;
  id: number;
  emailVerifiedAt: string | null;
  name: string;
  email: string;
  isEmailVerified: boolean;
  username: string | null;
  stats: {
    rooms: number;
    notes: number;
    friends: number;
  };
};

export type MovieSearchResult = {
  id: number;
  mediaType: MediaType;
  title: string;
  overview: string;
  posterPath: string | null;
  posterUrl: string | null;
  releaseYear: number | null;
  rating: number | null;
  mediaLabel: string;
  sourceKind?: SearchSourceKind | null;
  sourceLabel?: string | null;
  sourceProvider?: string | null;
  shikimoriId?: number | null;
  jellyfinItemId?: string | null;
  jellyfinItemType?: 'Movie' | 'Series' | 'Episode' | 'Video' | null;
  episodeCount?: number | null;
  seasonCount?: number | null;
  videoUrl?: string | null;
};

export type MovieDetails = MovieSearchResult & {
  backdropPath: string | null;
  backdropUrl: string | null;
  episodeCount: number | null;
  genres: string[];
  runtime: number | null;
  seasonCount: number | null;
};

export type MovieRecommendation = MovieSearchResult;

export type PersonPreview = {
  avatarTheme: string;
  avatarUrl: string | null;
  id: number;
  name: string;
  email: string;
  username: string | null;
};

export type RelationshipStatus =
  | 'self'
  | 'friend'
  | 'incoming_request'
  | 'outgoing_request'
  | 'none';

export type ProfileRelationship = {
  friendshipId: number | null;
  status: RelationshipStatus;
};

export type NoteStatus = 'pending' | 'sent' | 'accepted' | 'rejected';

export type MovieNote = {
  id: number;
  mediaType: MediaType;
  tmdbId: number;
  movieTitle: string;
  posterPath: string | null;
  posterUrl: string | null;
  releaseYear: number | null;
  noteText: string;
  status: NoteStatus;
  owner: PersonPreview | null;
  recipient: PersonPreview | null;
  sentAt: string | null;
  respondedAt: string | null;
  createdAt: string | null;
};

export type NotesPayload = {
  own: MovieNote[];
  incoming: MovieNote[];
};

export type Friend = {
  bio: string;
  friendshipId: number;
} & PersonPreview;

export type FriendRequest = {
  id: number;
  direction: 'incoming' | 'outgoing';
  status: string;
  user: PersonPreview;
  createdAt: string | null;
};

export type FriendRequestsPayload = {
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  user: AuthUser;
};

export type RegistrationChallenge = {
  debugCode?: string;
  email: string;
  expiresAt: string;
  message: string;
  verificationRequired: true;
};

export type VideoSourceKind = 'none' | 'youtube' | 'direct' | 'external';

export type VideoSource = {
  embedUrl: string | null;
  embeddable: boolean;
  kind: VideoSourceKind;
  label: string;
  provider: string | null;
  videoId: string | null;
};

export type WatchRoomShare = {
  deepLink: string;
  inviteText: string;
};

export type WatchPlayback = {
  lastSyncedAt: string | null;
  lastSyncedByUserId: number | null;
  positionMs: number;
  rate: number;
  state: 'playing' | 'paused' | 'ended';
};

export type WatchRoomMessage = {
  id: number;
  kind: 'chat' | 'note' | 'system';
  body: string;
  createdAt: string | null;
  user: PersonPreview | null;
};

export type WatchRoomSummary = {
  code: string;
  hasVideoSource: boolean;
  host: PersonPreview | null;
  isHost: boolean;
  mediaType: MediaType;
  memberCount: number;
  movieTitle: string;
  playback: WatchPlayback;
  posterPath: string | null;
  posterUrl: string | null;
  releaseYear: number | null;
  share: WatchRoomShare;
  source: VideoSource;
  updatedAt: string | null;
};

export type WatchRoom = WatchRoomSummary & {
  members: Array<PersonPreview & { lastSeenAt: string | null }>;
  messages: WatchRoomMessage[];
  tmdbId: number | null;
  videoUrl: string | null;
};

export type WatchRoomInvite = {
  id: number;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string | null;
  respondedAt: string | null;
  room: WatchRoomSummary;
  sender: PersonPreview | null;
  recipient: PersonPreview | null;
};

export type WatchRoomInvitesPayload = {
  incoming: WatchRoomInvite[];
  outgoing: WatchRoomInvite[];
};

export type UserProfile = AuthUser & {
  relationship: ProfileRelationship;
};

export type UserSearchResult = PersonPreview & {
  bio: string;
  relationship: ProfileRelationship;
};
