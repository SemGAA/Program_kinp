ALTER TABLE users ADD COLUMN username TEXT;
ALTER TABLE users ADD COLUMN bio TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN avatar_url TEXT;
ALTER TABLE users ADD COLUMN avatar_theme TEXT NOT NULL DEFAULT 'sunset';
ALTER TABLE users ADD COLUMN email_verified_at TEXT;
ALTER TABLE users ADD COLUMN email_verification_code_hash TEXT;
ALTER TABLE users ADD COLUMN email_verification_sent_at TEXT;
ALTER TABLE users ADD COLUMN email_verification_expires_at TEXT;
CREATE UNIQUE INDEX idx_users_username ON users(username);
