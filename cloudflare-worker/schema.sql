CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS friendships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_one_id INTEGER NOT NULL,
  user_two_id INTEGER NOT NULL,
  requested_by_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  responded_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_one_id, user_two_id)
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  sent_to INTEGER,
  tmdb_id INTEGER NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'movie',
  movie_title TEXT NOT NULL,
  poster_path TEXT,
  release_year INTEGER,
  note_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TEXT,
  responded_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS watch_rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  host_user_id INTEGER NOT NULL,
  movie_title TEXT NOT NULL,
  video_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'movie',
  poster_path TEXT,
  release_year INTEGER,
  tmdb_id INTEGER,
  playback_state TEXT NOT NULL DEFAULT 'paused',
  playback_position_ms INTEGER NOT NULL DEFAULT 0,
  playback_rate REAL NOT NULL DEFAULT 1,
  last_synced_at TEXT,
  last_synced_by_user_id INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS watch_room_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  watch_room_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  last_seen_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(watch_room_id, user_id)
);

CREATE TABLE IF NOT EXISTS watch_room_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  watch_room_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'chat',
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS watch_room_invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  watch_room_id INTEGER NOT NULL,
  sender_user_id INTEGER NOT NULL,
  recipient_user_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  responded_at TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE(watch_room_id, recipient_user_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);
CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_sent_to ON notes(sent_to);
CREATE INDEX IF NOT EXISTS idx_watch_rooms_host ON watch_rooms(host_user_id);
CREATE INDEX IF NOT EXISTS idx_watch_room_members_room ON watch_room_members(watch_room_id);
CREATE INDEX IF NOT EXISTS idx_watch_room_members_user ON watch_room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_watch_room_messages_room ON watch_room_messages(watch_room_id);
CREATE INDEX IF NOT EXISTS idx_watch_room_invites_recipient ON watch_room_invites(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_watch_room_invites_sender ON watch_room_invites(sender_user_id);
