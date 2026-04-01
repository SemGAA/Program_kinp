export type AuthUser = {
  id: number;
  name: string;
  email: string;
  stats: {
    notes: number;
    friends: number;
  };
};

export type MovieSearchResult = {
  id: number;
  title: string;
  overview: string;
  posterPath: string | null;
  posterUrl: string | null;
  releaseYear: number | null;
  rating: number | null;
};

export type MovieDetails = MovieSearchResult & {
  backdropPath: string | null;
  backdropUrl: string | null;
  genres: string[];
  runtime: number | null;
};

export type MovieRecommendation = MovieSearchResult;

export type PersonPreview = {
  id: number;
  name: string;
  email: string;
};

export type NoteStatus = 'pending' | 'sent' | 'accepted' | 'rejected';

export type MovieNote = {
  id: number;
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
  id: number;
  name: string;
  email: string;
  friendshipId: number;
};

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

export type WatchPlayback = {
  lastSyncedAt: string | null;
  lastSyncedByUserId: number | null;
  positionMs: number;
  rate: number;
  state: 'playing' | 'paused' | 'ended';
};

export type WatchRoomMessage = {
  id: number;
  kind: 'chat' | 'note';
  body: string;
  createdAt: string | null;
  user: PersonPreview | null;
};

export type WatchRoomSummary = {
  code: string;
  host: PersonPreview | null;
  isHost: boolean;
  memberCount: number;
  movieTitle: string;
  playback: WatchPlayback;
  posterPath: string | null;
  posterUrl: string | null;
  releaseYear: number | null;
  updatedAt: string | null;
};

export type WatchRoom = WatchRoomSummary & {
  members: Array<PersonPreview & { lastSeenAt: string | null }>;
  messages: WatchRoomMessage[];
  tmdbId: number | null;
  videoUrl: string;
};
