const JSON_HEADERS = {
  'content-type': 'application/json; charset=UTF-8',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
};

const TMDB_API_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const TMDB_API_KEY_FALLBACK = 'c05cabab9351fafd2b28de9c14964ab4';
const LATEST_ANDROID_APK_PART_URLS = [
  'https://raw.githubusercontent.com/SemGAA/Program_kinp/apk-downloads/downloads/parts/cinema-notes-1.5.3.part.000',
  'https://raw.githubusercontent.com/SemGAA/Program_kinp/apk-downloads/downloads/parts/cinema-notes-1.5.3.part.001',
  'https://raw.githubusercontent.com/SemGAA/Program_kinp/apk-downloads/downloads/parts/cinema-notes-1.5.3.part.002',
  'https://raw.githubusercontent.com/SemGAA/Program_kinp/apk-downloads/downloads/parts/cinema-notes-1.5.3.part.003',
  'https://raw.githubusercontent.com/SemGAA/Program_kinp/apk-downloads/downloads/parts/cinema-notes-1.5.3.part.004',
  'https://raw.githubusercontent.com/SemGAA/Program_kinp/apk-downloads/downloads/parts/cinema-notes-1.5.3.part.005',
  'https://raw.githubusercontent.com/SemGAA/Program_kinp/apk-downloads/downloads/parts/cinema-notes-1.5.3.part.006',
  'https://raw.githubusercontent.com/SemGAA/Program_kinp/apk-downloads/downloads/parts/cinema-notes-1.5.3.part.007',
];
const APP_SCHEME = 'cinemaapp';
const EMAIL_CODE_TTL_MS = 15 * 60 * 1000;
const EMAIL_CODE_RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_AVATAR_URL_LENGTH = 700000;
const MAX_AUTO_VIDEO_CANDIDATES = 18;
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 24;
const VIDEO_SEARCH_TIMEOUT_MS = 8000;
const DEFAULT_AVATAR_THEME = 'sunset';
const ROOM_MESSAGE_LIMIT = 100;
const NOTE_SELECT_SQL = `
  SELECT
    n.*,
    owner.id AS owner_id,
    owner.name AS owner_name,
    owner.email AS owner_email,
    owner.username AS owner_username,
    owner.avatar_url AS owner_avatar_url,
    owner.avatar_theme AS owner_avatar_theme,
    recipient.id AS recipient_id,
    recipient.name AS recipient_name,
    recipient.email AS recipient_email,
    recipient.username AS recipient_username,
    recipient.avatar_url AS recipient_avatar_url,
    recipient.avatar_theme AS recipient_avatar_theme
  FROM notes n
  LEFT JOIN users owner ON owner.id = n.user_id
  LEFT JOIN users recipient ON recipient.id = n.sent_to
`;

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      console.error('Unhandled error', error);
      return json({ message: 'Internal server error.' }, 500);
    }
  },
};

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        ...CORS_HEADERS,
      },
      status: 204,
    });
  }

  if (pathname === '/' || pathname === '') {
    return json({ message: 'Cinema Notes API is live.', ok: true });
  }

  if (pathname === '/api/ping') {
    return json({ ok: true, timestamp: nowIso() });
  }

  if (pathname === '/downloads/cinema-notes-android.apk' && request.method === 'GET') {
    return handleLatestApkDownload();
  }

  if (pathname === '/api/register' && request.method === 'POST') {
    return handleRegister(request, env);
  }

  if (pathname === '/api/register/verify' && request.method === 'POST') {
    return handleVerifyRegistration(request, env);
  }

  if (pathname === '/api/register/resend' && request.method === 'POST') {
    return handleResendRegistrationCode(request, env);
  }

  if (pathname === '/api/login' && request.method === 'POST') {
    return handleLogin(request, env);
  }

  const auth = await requireAuth(request, env);
  if (auth instanceof Response) {
    return auth;
  }

  if (pathname === '/api/logout' && request.method === 'POST') {
    await run(env.DB, 'DELETE FROM sessions WHERE token = ?', [auth.token]);
    return json({ message: 'Signed out.' });
  }

  if (pathname === '/api/user' && request.method === 'GET') {
    return json(await formatAuthUser(env, auth.user));
  }

  if (pathname === '/api/users/search' && request.method === 'GET') {
    return handleUserSearch(url, env, auth.user);
  }

  if (pathname === '/api/profile' && request.method === 'PATCH') {
    return handleUpdateProfile(request, env, auth.user);
  }

  const userProfileMatch = pathname.match(/^\/api\/users\/(\d+)$/);
  if (userProfileMatch && request.method === 'GET') {
    return handleUserProfile(env, auth.user, Number(userProfileMatch[1]));
  }

  if (pathname === '/api/friends' && request.method === 'GET') {
    return json({ data: await listFriends(env, auth.user.id) });
  }

  const friendDeleteMatch = pathname.match(/^\/api\/friends\/(\d+)$/);
  if (friendDeleteMatch && request.method === 'DELETE') {
    return handleDeleteFriendship(env, auth.user, Number(friendDeleteMatch[1]));
  }

  if (pathname === '/api/friend-requests' && request.method === 'GET') {
    return json(await listFriendRequests(env, auth.user.id));
  }

  if (pathname === '/api/friend-requests' && request.method === 'POST') {
    return handleCreateFriendRequest(request, env, auth.user);
  }

  const friendAcceptMatch = pathname.match(/^\/api\/friend-requests\/(\d+)\/accept$/);
  if (friendAcceptMatch && request.method === 'POST') {
    return handleAcceptFriendRequest(env, auth.user, Number(friendAcceptMatch[1]));
  }

  const friendRejectMatch = pathname.match(/^\/api\/friend-requests\/(\d+)\/reject$/);
  if (friendRejectMatch && request.method === 'POST') {
    return handleRejectFriendRequest(env, auth.user, Number(friendRejectMatch[1]));
  }

  if (pathname === '/api/notes' && request.method === 'GET') {
    return json(await listNotes(env, auth.user.id));
  }

  if (pathname === '/api/notes/match' && request.method === 'GET') {
    return handleMatchedNote(url, env, auth.user.id);
  }

  if (pathname === '/api/notes' && request.method === 'POST') {
    return handleCreateNote(request, env, auth.user);
  }

  const noteUpdateMatch = pathname.match(/^\/api\/notes\/(\d+)$/);
  if (noteUpdateMatch && request.method === 'PATCH') {
    return handleUpdateNote(request, env, auth.user, Number(noteUpdateMatch[1]));
  }

  const noteShareMatch = pathname.match(/^\/api\/notes\/(\d+)\/share$/);
  if (noteShareMatch && request.method === 'POST') {
    return handleShareNote(request, env, auth.user, Number(noteShareMatch[1]));
  }

  const noteAcceptMatch = pathname.match(/^\/api\/notes\/(\d+)\/accept$/);
  if (noteAcceptMatch && request.method === 'POST') {
    return handleRespondToNote(env, auth.user, Number(noteAcceptMatch[1]), 'accepted');
  }

  const noteRejectMatch = pathname.match(/^\/api\/notes\/(\d+)\/reject$/);
  if (noteRejectMatch && request.method === 'POST') {
    return handleRespondToNote(env, auth.user, Number(noteRejectMatch[1]), 'rejected');
  }

  if (pathname === '/api/watch-rooms' && request.method === 'GET') {
    return json({ data: await listWatchRooms(env, auth.user.id) });
  }

  if (pathname === '/api/watch-room-invites' && request.method === 'GET') {
    return json(await listWatchRoomInvites(env, auth.user.id));
  }

  if (pathname === '/api/watch-rooms' && request.method === 'POST') {
    return handleCreateWatchRoom(request, env, auth.user);
  }

  if (pathname === '/api/watch-rooms/join' && request.method === 'POST') {
    return handleJoinWatchRoom(request, env, auth.user);
  }

  const watchShowMatch = pathname.match(/^\/api\/watch-rooms\/([A-Za-z0-9_-]+)$/);
  if (watchShowMatch && request.method === 'GET') {
    return handleShowWatchRoom(env, auth.user, watchShowMatch[1]);
  }

  const watchInviteMatch = pathname.match(/^\/api\/watch-rooms\/([A-Za-z0-9_-]+)\/invite$/);
  if (watchInviteMatch && request.method === 'POST') {
    return handleCreateWatchRoomInvite(request, env, auth.user, watchInviteMatch[1]);
  }

  const watchSourceMatch = pathname.match(/^\/api\/watch-rooms\/([A-Za-z0-9_-]+)\/source$/);
  if (watchSourceMatch && request.method === 'PATCH') {
    return handleUpdateWatchRoomSource(request, env, auth.user, watchSourceMatch[1]);
  }

  const watchSyncMatch = pathname.match(/^\/api\/watch-rooms\/([A-Za-z0-9_-]+)\/sync$/);
  if (watchSyncMatch && request.method === 'POST') {
    return handleSyncWatchRoom(request, env, auth.user, watchSyncMatch[1]);
  }

  const watchMessageMatch = pathname.match(/^\/api\/watch-rooms\/([A-Za-z0-9_-]+)\/messages$/);
  if (watchMessageMatch && request.method === 'POST') {
    return handleWatchRoomMessage(request, env, auth.user, watchMessageMatch[1]);
  }

  const watchInviteAcceptMatch = pathname.match(/^\/api\/watch-room-invites\/(\d+)\/accept$/);
  if (watchInviteAcceptMatch && request.method === 'POST') {
    return handleAcceptWatchRoomInvite(env, auth.user, Number(watchInviteAcceptMatch[1]));
  }

  const watchInviteRejectMatch = pathname.match(/^\/api\/watch-room-invites\/(\d+)\/reject$/);
  if (watchInviteRejectMatch && request.method === 'POST') {
    return handleRejectWatchRoomInvite(env, auth.user, Number(watchInviteRejectMatch[1]));
  }

  if (pathname === '/api/movies/search' && request.method === 'GET') {
    return handleMovieSearch(url, env);
  }

  const movieRecommendationsMatch = pathname.match(/^\/api\/movies\/(\d+)\/recommendations$/);
  if (movieRecommendationsMatch && request.method === 'GET') {
    return handleMovieRecommendations(url, env, Number(movieRecommendationsMatch[1]));
  }

  const movieDetailsMatch = pathname.match(/^\/api\/movies\/(\d+)$/);
  if (movieDetailsMatch && request.method === 'GET') {
    return handleMovieDetails(url, env, Number(movieDetailsMatch[1]));
  }

  return json({ message: 'Not found.' }, 404);
}

async function handleLatestApkDownload() {
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for (const partUrl of LATEST_ANDROID_APK_PART_URLS) {
          const upstream = await fetch(partUrl, {
            headers: {
              accept: 'application/octet-stream,*/*',
              'user-agent': 'Mozilla/5.0 (Cinema Notes APK Proxy)',
            },
            redirect: 'follow',
          });

          if (!upstream.ok || !upstream.body) {
            throw new Error(`APK part is unavailable: ${partUrl}`);
          }

          const reader = upstream.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }

            controller.enqueue(value);
          }
        }

        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
      'Content-Disposition': 'attachment; filename=\"Cinema-Notes-1.5.3.apk\"',
      'Content-Type': 'application/vnd.android.package-archive',
    },
    status: 200,
  });
}

async function handleRegister(request, env) {
  const body = await parseJson(request);
  if (body instanceof Response) {
    return body;
  }

  const name = String(body.name || '').trim();
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');

  if (!name || !email || !password) {
    return validationError({
      message: 'Name, email, and password are required.',
      errors: {
        name: !name ? ['Name is required.'] : undefined,
        email: !email ? ['Email is required.'] : undefined,
        password: !password ? ['Password is required.'] : undefined,
      },
    });
  }

  if (!isValidEmail(email)) {
    return validationError({
      message: 'Please provide a valid email.',
      errors: {
        email: ['Please provide a valid email.'],
      },
    });
  }

  if (password.length < 8) {
    return validationError({
      message: 'Password must be at least 8 characters.',
      errors: {
        password: ['Password must be at least 8 characters.'],
      },
    });
  }

  const existing = await first(env.DB, 'SELECT * FROM users WHERE email = ?', [email]);
  if (existing?.email_verified_at) {
    return validationError({
      message: 'A user with this email already exists.',
      errors: {
        email: ['A user with this email already exists.'],
      },
    });
  }

  const timestamp = nowIso();
  const passwordHash = await hashPassword(password);
  const username = await buildUniqueUsername(
    env,
    existing?.username || body.username || email.split('@')[0] || name,
    existing?.id ?? null,
  );
  const avatarTheme = existing?.avatar_theme || pickAvatarTheme(name || email);

  let userId = existing?.id ? Number(existing.id) : null;

  if (existing) {
    await run(
      env.DB,
      'UPDATE users SET name = ?, password_hash = ?, username = ?, avatar_theme = ?, updated_at = ? WHERE id = ?',
      [name, passwordHash, username, avatarTheme, timestamp, existing.id],
    );
  } else {
    const insert = await run(
      env.DB,
      'INSERT INTO users (name, email, password_hash, username, bio, avatar_url, avatar_theme, email_verified_at, email_verification_code_hash, email_verification_sent_at, email_verification_expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, ?)',
      [name, email, passwordHash, username, '', null, avatarTheme, timestamp, timestamp],
    );
    userId = Number(insert.meta.last_row_id);
  }

  const user = await getUserById(env, userId);
  const verification = await issueEmailVerificationCode(env, user, {
    enforceCooldown: false,
  });

  if (verification instanceof Response) {
    return verification;
  }

  return json(
    {
      email: user.email,
      expiresAt: verification.expiresAt,
      message: 'Verification code sent. Please confirm your email to finish registration.',
      verificationRequired: true,
      ...(verification.debugCode ? { debugCode: verification.debugCode } : null),
    },
    existing ? 200 : 201,
  );
}

async function handleVerifyRegistration(request, env) {
  const body = await parseJson(request);
  if (body instanceof Response) {
    return body;
  }

  const email = normalizeEmail(body.email);
  const code = normalizeVerificationCode(body.code);

  if (!email || !code) {
    return validationError({
      message: 'Email and verification code are required.',
      errors: {
        email: !email ? ['Email is required.'] : undefined,
        code: !code ? ['Verification code is required.'] : undefined,
      },
    });
  }

  const user = await first(env.DB, 'SELECT * FROM users WHERE email = ?', [email]);
  if (!user) {
    return json({ message: 'User not found.' }, 404);
  }

  if (user.email_verified_at) {
    return json({ message: 'Email is already verified. Please sign in.' }, 422);
  }

  if (!user.email_verification_code_hash || !user.email_verification_expires_at) {
    return json({ message: 'Please request a new verification code.' }, 422);
  }

  if (Date.parse(user.email_verification_expires_at) < Date.now()) {
    return json({ message: 'Verification code has expired. Request a new one.' }, 422);
  }

  const isValidCode = await verifyHashedValue(env, code, user.email_verification_code_hash);
  if (!isValidCode) {
    return json({ message: 'Invalid verification code.' }, 422);
  }

  await run(
    env.DB,
    'UPDATE users SET email_verified_at = ?, email_verification_code_hash = NULL, email_verification_sent_at = NULL, email_verification_expires_at = NULL, updated_at = ? WHERE id = ?',
    [nowIso(), nowIso(), user.id],
  );

  const verifiedUser = await getUserById(env, user.id);
  const token = await createSession(env, user.id);

  return json({
    access_token: token,
    token_type: 'Bearer',
    user: await formatAuthUser(env, verifiedUser),
  });
}

async function handleResendRegistrationCode(request, env) {
  const body = await parseJson(request);
  if (body instanceof Response) {
    return body;
  }

  const email = normalizeEmail(body.email);
  if (!email) {
    return validationError({
      message: 'Email is required.',
      errors: {
        email: ['Email is required.'],
      },
    });
  }

  const user = await first(env.DB, 'SELECT * FROM users WHERE email = ?', [email]);
  if (!user) {
    return json({ message: 'User not found.' }, 404);
  }

  if (user.email_verified_at) {
    return json({ message: 'Email is already verified. Please sign in.' }, 422);
  }

  const verification = await issueEmailVerificationCode(env, user, {
    enforceCooldown: true,
  });

  if (verification instanceof Response) {
    return verification;
  }

  return json({
    email,
    expiresAt: verification.expiresAt,
    message: 'A new verification code has been sent.',
    verificationRequired: true,
    ...(verification.debugCode ? { debugCode: verification.debugCode } : null),
  });
}

async function handleLogin(request, env) {
  const body = await parseJson(request);
  if (body instanceof Response) {
    return body;
  }

  const email = normalizeEmail(body.email);
  const password = String(body.password || '');

  if (!email || !password) {
    return validationError({
      message: 'Email and password are required.',
      errors: {
        email: !email ? ['Email is required.'] : undefined,
        password: !password ? ['Password is required.'] : undefined,
      },
    });
  }

  const user = await first(env.DB, 'SELECT * FROM users WHERE email = ?', [email]);
  if (!user) {
    return json({ message: 'Invalid email or password.' }, 401);
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return json({ message: 'Invalid email or password.' }, 401);
  }

  if (!user.email_verified_at) {
    return json(
      {
        email,
        message: 'Please confirm your email before signing in.',
        verificationRequired: true,
      },
      403,
    );
  }

  const token = await createSession(env, user.id);
  return json({
    access_token: token,
    token_type: 'Bearer',
    user: await formatAuthUser(env, user),
  });
}

async function issueEmailVerificationCode(env, user, options = {}) {
  const previousSentAt = user.email_verification_sent_at ? Date.parse(user.email_verification_sent_at) : null;

  if (options.enforceCooldown && previousSentAt && Date.now() - previousSentAt < EMAIL_CODE_RESEND_COOLDOWN_MS) {
    const retryAfterMs = EMAIL_CODE_RESEND_COOLDOWN_MS - (Date.now() - previousSentAt);
    return json(
      {
        message: 'Please wait before requesting another verification code.',
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      },
      429,
    );
  }

  const code = generateVerificationCode();
  const codeHash = await hashValue(env, code);
  const sentAt = nowIso();
  const expiresAt = new Date(Date.now() + EMAIL_CODE_TTL_MS).toISOString();

  await run(
    env.DB,
    'UPDATE users SET email_verification_code_hash = ?, email_verification_sent_at = ?, email_verification_expires_at = ?, updated_at = ? WHERE id = ?',
    [codeHash, sentAt, expiresAt, sentAt, user.id],
  );

  const delivery = await sendVerificationCodeEmail(env, {
    code,
    email: user.email,
    name: user.name,
  });

  return {
    debugCode: delivery.debugCode || null,
    expiresAt,
  };
}

async function handleMovieSearch(url, env) {
  const query = String(url.searchParams.get('q') || '').trim();
  if (query.length < 2) {
    return validationError({
      message: 'Query must be at least 2 characters.',
      errors: {
        q: ['Query must be at least 2 characters.'],
      },
    });
  }

  let tmdbResults = [];
  try {
    const payload = await tmdbRequest(env, '/search/multi', {
      include_adult: 'false',
      language: 'ru-RU',
      query,
    });

    tmdbResults = Array.isArray(payload.results)
      ? payload.results
          .filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
          .map((item) => mapTmdbSummary(item, item.media_type === 'tv' ? 'tv' : 'movie'))
      : [];
  } catch (error) {
    console.error('TMDB search failed, using video fallback', error);
  }

  const videoResults = await searchAutoVideoCatalog(query).catch((error) => {
    console.error('Automatic video search failed', error);
    return [];
  });

  const dedupedResults = dedupeMovieResults([...tmdbResults, ...videoResults]).slice(0, 24);

  return json({ data: dedupedResults });
}

async function handleMovieDetails(url, env, tmdbId) {
  const mediaType = normalizeMediaType(url.searchParams.get('mediaType'));
  const payload = await tmdbRequest(env, `/${mediaType}/${tmdbId}`, {
    language: 'ru-RU',
  });

  return json({
    data: mapTmdbDetails(payload, mediaType),
  });
}

async function handleMovieRecommendations(url, env, tmdbId) {
  const mediaType = normalizeMediaType(url.searchParams.get('mediaType'));
  const payload = await tmdbRequest(env, `/${mediaType}/${tmdbId}/recommendations`, {
    language: 'ru-RU',
  });

  const results = Array.isArray(payload.results)
    ? payload.results.map((item) => mapTmdbSummary(item, mediaType))
    : [];

  return json({ data: results });
}

async function handleCreateFriendRequest(request, env, currentUser) {
  const body = await parseJson(request);
  if (body instanceof Response) {
    return body;
  }

  const identifier = String(body.email || body.identifier || body.username || '').trim();
  const email = normalizeEmail(identifier);
  const username = sanitizeUsername(identifier);

  if (!identifier) {
    return validationError({
      message: 'Email or username is required.',
      errors: {
        email: ['Email or username is required.'],
      },
    });
  }

  const recipient = await first(
    env.DB,
    'SELECT * FROM users WHERE email_verified_at IS NOT NULL AND (LOWER(email) = ? OR LOWER(username) = ?) LIMIT 1',
    [email, username.toLowerCase()],
  );
  if (!recipient) {
    return validationError({
      message: 'User not found.',
      errors: {
        email: ['User with this email or username was not found.'],
      },
    });
  }

  if (Number(recipient.id) === Number(currentUser.id)) {
    return json({ message: 'You cannot send a request to yourself.' }, 422);
  }

  const [userOneId, userTwoId] = pairUserIds(currentUser.id, recipient.id);
  const existing = await first(
    env.DB,
    'SELECT * FROM friendships WHERE user_one_id = ? AND user_two_id = ?',
    [userOneId, userTwoId],
  );

  if (existing?.status === 'accepted') {
    return json({ message: 'Users are already friends.' }, 422);
  }

  if (existing?.status === 'pending') {
    return json(
      {
        message:
          Number(existing.requested_by_id) === Number(currentUser.id)
            ? 'Request already sent.'
            : 'There is already an incoming request from this user.',
      },
      422,
    );
  }

  const timestamp = nowIso();

  if (existing) {
    await run(
      env.DB,
      'UPDATE friendships SET requested_by_id = ?, status = ?, responded_at = NULL, updated_at = ? WHERE id = ?',
      [currentUser.id, 'pending', timestamp, existing.id],
    );
  } else {
    await run(
      env.DB,
      'INSERT INTO friendships (user_one_id, user_two_id, requested_by_id, status, responded_at, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, ?, ?)',
      [userOneId, userTwoId, currentUser.id, 'pending', timestamp, timestamp],
    );
  }

  const friendship = await first(
    env.DB,
    'SELECT * FROM friendships WHERE user_one_id = ? AND user_two_id = ?',
    [userOneId, userTwoId],
  );

  return json(
    {
      data: await formatFriendRequest(env, friendship, currentUser.id),
    },
    201,
  );
}

async function handleAcceptFriendRequest(env, currentUser, friendshipId) {
  const friendship = await first(env.DB, 'SELECT * FROM friendships WHERE id = ?', [friendshipId]);

  if (!canRespondToFriendship(friendship, currentUser.id)) {
    return json({ message: 'This request cannot be accepted.' }, 403);
  }

  await run(
    env.DB,
    'UPDATE friendships SET status = ?, responded_at = ?, updated_at = ? WHERE id = ?',
    ['accepted', nowIso(), nowIso(), friendshipId],
  );

  const updated = await first(env.DB, 'SELECT * FROM friendships WHERE id = ?', [friendshipId]);
  return json({
    data: await formatFriend(env, updated, currentUser.id),
  });
}

async function handleRejectFriendRequest(env, currentUser, friendshipId) {
  const friendship = await first(env.DB, 'SELECT * FROM friendships WHERE id = ?', [friendshipId]);

  if (!canRespondToFriendship(friendship, currentUser.id)) {
    return json({ message: 'This request cannot be rejected.' }, 403);
  }

  await run(
    env.DB,
    'UPDATE friendships SET status = ?, responded_at = ?, updated_at = ? WHERE id = ?',
    ['rejected', nowIso(), nowIso(), friendshipId],
  );

  return json({ message: 'Request rejected.' });
}

async function handleUserSearch(url, env, currentUser) {
  const query = String(url.searchParams.get('q') || '').trim().toLowerCase();

  if (query.length < 2) {
    return validationError({
      message: 'Query must be at least 2 characters.',
      errors: {
        q: ['Query must be at least 2 characters.'],
      },
    });
  }

  const likeQuery = `%${escapeLikeValue(query)}%`;
  const rows = await all(
    env.DB,
    `SELECT *
     FROM users
     WHERE id != ?
       AND email_verified_at IS NOT NULL
       AND (
         LOWER(name) LIKE ? ESCAPE '\\'
         OR LOWER(username) LIKE ? ESCAPE '\\'
         OR LOWER(email) LIKE ? ESCAPE '\\'
       )
     ORDER BY
       CASE
         WHEN LOWER(username) = ? THEN 0
         WHEN LOWER(email) = ? THEN 1
         WHEN LOWER(name) = ? THEN 2
         ELSE 3
       END,
       updated_at DESC
     LIMIT 20`,
    [currentUser.id, likeQuery, likeQuery, likeQuery, query, query, query],
  );

  return json({
    data: await Promise.all(rows.map((user) => formatProfileListItem(env, user, currentUser.id))),
  });
}

async function handleUserProfile(env, currentUser, profileUserId) {
  const user = await getUserById(env, profileUserId);
  if (!user || (!user.email_verified_at && Number(user.id) !== Number(currentUser.id))) {
    return json({ message: 'Profile not found.' }, 404);
  }

  return json({
    data: await formatPublicUserProfile(env, user, currentUser.id),
  });
}

async function handleUpdateProfile(request, env, currentUser) {
  const body = await parseJson(request);
  if (body instanceof Response) {
    return body;
  }

  const nextName = String(body.name ?? currentUser.name ?? '').trim();
  const requestedUsername = body.username ?? currentUser.username;
  const username = sanitizeUsername(requestedUsername);
  const bio = String(body.bio ?? currentUser.bio ?? '').trim();
  const avatarUrl = normalizeAvatarUrl(body.avatar_url);
  const avatarTheme = normalizeAvatarTheme(body.avatar_theme ?? currentUser.avatar_theme);

  if (!nextName) {
    return validationError({
      message: 'Name is required.',
      errors: {
        name: ['Name is required.'],
      },
    });
  }

  if (!username || username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
    return validationError({
      message: `Username must be ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters and use latin letters, numbers, dots, or underscores.`,
      errors: {
        username: [`Username must be ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters.`],
      },
    });
  }

  if (bio.length > 240) {
    return validationError({
      message: 'Profile description must be at most 240 characters.',
      errors: {
        bio: ['Profile description must be at most 240 characters.'],
      },
    });
  }

  if (avatarUrl === false) {
    return validationError({
      message: 'Avatar must be a valid https URL or image data URL.',
      errors: {
        avatar_url: ['Avatar must be a valid https URL or image data URL.'],
      },
    });
  }

  const existingUsername = await first(
    env.DB,
    'SELECT id FROM users WHERE LOWER(username) = ? AND id != ?',
    [username.toLowerCase(), currentUser.id],
  );

  if (existingUsername) {
    return validationError({
      message: 'This username is already taken.',
      errors: {
        username: ['This username is already taken.'],
      },
    });
  }

  await run(
    env.DB,
    'UPDATE users SET name = ?, username = ?, bio = ?, avatar_url = ?, avatar_theme = ?, updated_at = ? WHERE id = ?',
    [nextName, username, bio, avatarUrl, avatarTheme, nowIso(), currentUser.id],
  );

  const updatedUser = await getUserById(env, currentUser.id);
  return json({
    data: await formatAuthUser(env, updatedUser),
  });
}

async function handleDeleteFriendship(env, currentUser, friendshipId) {
  const friendship = await first(env.DB, 'SELECT * FROM friendships WHERE id = ?', [friendshipId]);
  if (!friendship) {
    return json({ message: 'Relationship not found.' }, 404);
  }

  const isParticipant =
    Number(friendship.user_one_id) === Number(currentUser.id) ||
    Number(friendship.user_two_id) === Number(currentUser.id);

  if (!isParticipant) {
    return json({ message: 'You cannot delete this relationship.' }, 403);
  }

  await run(env.DB, 'DELETE FROM friendships WHERE id = ?', [friendshipId]);

  return json({
    message: friendship.status === 'accepted' ? 'Friend removed.' : 'Request removed.',
  });
}

async function handleCreateNote(request, env, currentUser) {
  const body = await parseJson(request);
  if (body instanceof Response) {
    return body;
  }

  const payload = validateNotePayload(body);
  if (payload instanceof Response) {
    return payload;
  }

  const timestamp = nowIso();
  const insert = await run(
    env.DB,
    'INSERT INTO notes (user_id, sent_to, tmdb_id, media_type, movie_title, poster_path, release_year, note_text, status, sent_at, responded_at, created_at, updated_at) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)',
    [
      currentUser.id,
      payload.tmdb_id,
      payload.media_type,
      payload.movie_title,
      payload.poster_path,
      payload.release_year,
      payload.note_text,
      'pending',
      timestamp,
      timestamp,
    ],
  );

  const note = await first(env.DB, 'SELECT * FROM notes WHERE id = ?', [insert.meta.last_row_id]);
  return json({ data: await formatNote(env, note) }, 201);
}

async function handleMatchedNote(url, env, userId) {
  const tmdbId = Number(url.searchParams.get('tmdbId'));
  const mediaType = normalizeMediaType(url.searchParams.get('mediaType'));

  if (!Number.isFinite(tmdbId)) {
    return validationError({
      message: 'tmdbId is required.',
      errors: {
        tmdbId: ['tmdbId is required.'],
      },
    });
  }

  const note = await first(
    env.DB,
    `${NOTE_SELECT_SQL}
     WHERE n.user_id = ? AND n.tmdb_id = ? AND n.media_type = ?
     ORDER BY n.updated_at DESC
     LIMIT 1`,
    [userId, tmdbId, mediaType],
  );

  return json({
    data: note ? await formatNote(env, note) : null,
  });
}

async function handleUpdateNote(request, env, currentUser, noteId) {
  const note = await first(env.DB, 'SELECT * FROM notes WHERE id = ?', [noteId]);
  if (!note || Number(note.user_id) !== Number(currentUser.id)) {
    return json({ message: 'You cannot edit this note.' }, 403);
  }

  const body = await parseJson(request);
  if (body instanceof Response) {
    return body;
  }

  const noteText = String(body.note_text || '').trim();
  if (!noteText) {
    return validationError({
      message: 'Note text is required.',
      errors: {
        note_text: ['Note text is required.'],
      },
    });
  }

  await run(env.DB, 'UPDATE notes SET note_text = ?, updated_at = ? WHERE id = ?', [noteText, nowIso(), noteId]);
  const updated = await first(env.DB, 'SELECT * FROM notes WHERE id = ?', [noteId]);
  return json({ data: await formatNote(env, updated) });
}

async function handleShareNote(request, env, currentUser, noteId) {
  const note = await first(env.DB, 'SELECT * FROM notes WHERE id = ?', [noteId]);
  if (!note || Number(note.user_id) !== Number(currentUser.id)) {
    return json({ message: 'You cannot send this note.' }, 403);
  }

  const body = await parseJson(request);
  if (body instanceof Response) {
    return body;
  }

  const recipientId = Number(body.recipient_id || 0);
  if (!recipientId) {
    return validationError({
      message: 'Recipient is required.',
      errors: {
        recipient_id: ['Recipient is required.'],
      },
    });
  }

  if (recipientId === Number(currentUser.id)) {
    return json({ message: 'You cannot send a note to yourself.' }, 422);
  }

  const areFriends = await usersAreFriends(env, currentUser.id, recipientId);
  if (!areFriends) {
    return json({ message: 'Notes can only be sent to friends.' }, 422);
  }

  await run(
    env.DB,
    'UPDATE notes SET sent_to = ?, status = ?, sent_at = ?, responded_at = NULL, updated_at = ? WHERE id = ?',
    [recipientId, 'sent', nowIso(), nowIso(), noteId],
  );

  const updated = await first(env.DB, 'SELECT * FROM notes WHERE id = ?', [noteId]);
  return json({ data: await formatNote(env, updated) });
}

async function handleRespondToNote(env, currentUser, noteId, nextStatus) {
  const note = await first(env.DB, 'SELECT * FROM notes WHERE id = ?', [noteId]);
  if (!note || Number(note.sent_to) !== Number(currentUser.id) || note.status !== 'sent') {
    return json({ message: 'This note cannot be updated.' }, 403);
  }

  await run(
    env.DB,
    'UPDATE notes SET status = ?, responded_at = ?, updated_at = ? WHERE id = ?',
    [nextStatus, nowIso(), nowIso(), noteId],
  );

  const updated = await first(env.DB, 'SELECT * FROM notes WHERE id = ?', [noteId]);
  return json({ data: await formatNote(env, updated) });
}

async function handleCreateWatchRoom(request, env, currentUser) {
  const body = await parseJson(request);
  if (body instanceof Response) {
    return body;
  }

  const movieTitle = String(body.movie_title || '').trim();
  const normalizedSource = normalizeVideoSourceInput(body.video_url);
  const mediaType = normalizeMediaType(body.media_type);
  const releaseYear = body.release_year ? Number(body.release_year) : null;

  if (!movieTitle) {
    return validationError({
      message: 'Movie title is required.',
      errors: {
        movie_title: !movieTitle ? ['Movie title is required.'] : undefined,
      },
    });
  }

  if (normalizedSource === false) {
    return validationError({
      message: 'Video URL must be a valid URL.',
      errors: {
        video_url: ['Video URL must be a valid URL.'],
      },
    });
  }

  const automaticVideoUrl = normalizedSource?.url || '';
  const finalSource = normalizeVideoSourceInput(automaticVideoUrl);

  const timestamp = nowIso();
  const code = await generateUniqueRoomCode(env);
  const insert = await run(
    env.DB,
    'INSERT INTO watch_rooms (code, host_user_id, movie_title, video_url, media_type, poster_path, release_year, tmdb_id, playback_state, playback_position_ms, playback_rate, last_synced_at, last_synced_by_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      code,
      currentUser.id,
      movieTitle,
      automaticVideoUrl || '',
      mediaType,
      body.poster_path ? String(body.poster_path) : null,
      releaseYear,
      body.tmdb_id ? Number(body.tmdb_id) : null,
      'paused',
      0,
      1,
      timestamp,
      currentUser.id,
      timestamp,
      timestamp,
    ],
  );

  const roomId = Number(insert.meta.last_row_id);
  await upsertRoomMember(env, roomId, currentUser.id);
  await appendSystemMessage(
    env,
    roomId,
    currentUser.id,
    automaticVideoUrl && finalSource !== false
      ? `Комната создана. Видео подключено автоматически: ${finalSource.source.label}.`
      : 'Комната создана. Ищем видео автоматически. Если источник найдётся, просмотр начнётся без ручной ссылки.',
  );
  return json({ data: await formatWatchRoom(env, roomId, currentUser.id) }, 201);
}

async function handleUpdateWatchRoomSource(request, env, currentUser, code) {
  const room = await first(env.DB, 'SELECT * FROM watch_rooms WHERE code = ?', [String(code).trim().toUpperCase()]);
  if (!room) {
    return json({ message: 'Room not found.' }, 404);
  }

  if (Number(room.host_user_id) !== Number(currentUser.id)) {
    return json({ message: 'Only the host can update the source.' }, 403);
  }

  const body = await parseJson(request);
  if (body instanceof Response) {
    return body;
  }

  const normalizedSource = normalizeVideoSourceInput(body.video_url);
  if (normalizedSource === false) {
    return validationError({
      message: 'Video URL must be a valid URL.',
      errors: {
        video_url: ['Video URL must be a valid URL.'],
      },
    });
  }

  await run(env.DB, 'UPDATE watch_rooms SET video_url = ?, updated_at = ? WHERE id = ?', [
    normalizedSource?.url || '',
    nowIso(),
    room.id,
  ]);
  await appendSystemMessage(
    env,
    room.id,
    currentUser.id,
    normalizedSource?.url
      ? `Источник обновлён: ${normalizedSource.source.label}.`
      : 'Источник удалён. Видео снова будет подбираться автоматически.',
  );

  return json({ data: await formatWatchRoom(env, room.id, currentUser.id) });
}

async function handleJoinWatchRoom(request, env, currentUser) {
  const body = await parseJson(request);
  if (body instanceof Response) {
    return body;
  }

  const code = String(body.code || '').trim().toUpperCase();
  if (!code) {
    return validationError({
      message: 'Room code is required.',
      errors: {
        code: ['Room code is required.'],
      },
    });
  }

  const room = await first(env.DB, 'SELECT * FROM watch_rooms WHERE code = ?', [code]);
  if (!room) {
    return json({ message: 'Room not found.' }, 404);
  }

  const existingMember = await roomMembership(env, room.id, currentUser.id);
  await upsertRoomMember(env, room.id, currentUser.id);
  if (!existingMember) {
    await appendSystemMessage(env, room.id, currentUser.id, `${currentUser.name} присоединился к комнате.`);
  }
  return json({ data: await formatWatchRoom(env, room.id, currentUser.id) });
}

async function handleCreateWatchRoomInvite(request, env, currentUser, code) {
  const room = await first(env.DB, 'SELECT * FROM watch_rooms WHERE code = ?', [String(code).trim().toUpperCase()]);
  if (!room) {
    return json({ message: 'Room not found.' }, 404);
  }

  if (Number(room.host_user_id) !== Number(currentUser.id)) {
    return json({ message: 'Only the host can invite friends.' }, 403);
  }

  const body = await parseJson(request);
  if (body instanceof Response) {
    return body;
  }

  const recipientId = Number(body.recipient_id);
  if (!Number.isFinite(recipientId)) {
    return validationError({
      message: 'Нужно указать получателя приглашения.',
      errors: {
        recipient_id: ['Нужно указать получателя приглашения.'],
      },
    });
  }

  if (Number(recipientId) === Number(currentUser.id)) {
    return json({ message: 'Нельзя приглашать самого себя.' }, 422);
  }

  const recipient = await getUserById(env, recipientId);
  if (!recipient) {
    return json({ message: 'Friend not found.' }, 404);
  }

  const friends = await usersAreFriends(env, currentUser.id, recipientId);
  if (!friends) {
    return json({ message: 'Приглашать можно только подтверждённых друзей.' }, 403);
  }

  const existing = await first(
    env.DB,
    'SELECT * FROM watch_room_invites WHERE watch_room_id = ? AND recipient_user_id = ?',
    [room.id, recipientId],
  );

  if (existing?.status === 'pending') {
    return json({ message: 'Приглашение уже отправлено.' }, 422);
  }

  const timestamp = nowIso();

  if (existing) {
    await run(
      env.DB,
      'UPDATE watch_room_invites SET sender_user_id = ?, status = ?, responded_at = NULL, updated_at = ? WHERE id = ?',
      [currentUser.id, 'pending', timestamp, existing.id],
    );
  } else {
    await run(
      env.DB,
      'INSERT INTO watch_room_invites (watch_room_id, sender_user_id, recipient_user_id, status, created_at, responded_at, updated_at) VALUES (?, ?, ?, ?, ?, NULL, ?)',
      [room.id, currentUser.id, recipientId, 'pending', timestamp, timestamp],
    );
  }

  const invite = await first(
    env.DB,
    'SELECT * FROM watch_room_invites WHERE watch_room_id = ? AND recipient_user_id = ?',
    [room.id, recipientId],
  );

  return json({ data: await formatWatchRoomInvite(env, invite, currentUser.id) }, existing ? 200 : 201);
}

async function handleShowWatchRoom(env, currentUser, code) {
  const room = await ensureRoomVideoSource(
    env,
    await first(env.DB, 'SELECT * FROM watch_rooms WHERE code = ?', [String(code).trim().toUpperCase()]),
  );
  if (!room) {
    return json({ message: 'Room not found.' }, 404);
  }

  const existingMember = await roomMembership(env, room.id, currentUser.id);
  await upsertRoomMember(env, room.id, currentUser.id);
  if (!existingMember) {
    await appendSystemMessage(env, room.id, currentUser.id, `${currentUser.name} присоединился к комнате.`);
  }
  return json({ data: await formatWatchRoom(env, room.id, currentUser.id) });
}

async function handleSyncWatchRoom(request, env, currentUser, code) {
  const room = await first(env.DB, 'SELECT * FROM watch_rooms WHERE code = ?', [String(code).trim().toUpperCase()]);
  if (!room) {
    return json({ message: 'Room not found.' }, 404);
  }

  if (Number(room.host_user_id) !== Number(currentUser.id)) {
    return json({ message: 'Only the host can control playback.' }, 403);
  }

  const body = await parseJson(request);
  if (body instanceof Response) {
    return body;
  }

  const playbackState = String(body.playback_state || '').trim();
  const positionMs = Number(body.playback_position_ms);
  const playbackRate = body.playback_rate == null ? 1 : Number(body.playback_rate);

  if (!['playing', 'paused', 'ended'].includes(playbackState) || !Number.isFinite(positionMs) || positionMs < 0) {
    return validationError({ message: 'Invalid playback payload.' });
  }

  await run(
    env.DB,
    'UPDATE watch_rooms SET playback_state = ?, playback_position_ms = ?, playback_rate = ?, last_synced_at = ?, last_synced_by_user_id = ?, updated_at = ? WHERE id = ?',
    [playbackState, Math.round(positionMs), playbackRate, nowIso(), currentUser.id, nowIso(), room.id],
  );

  const updated = await first(env.DB, 'SELECT * FROM watch_rooms WHERE id = ?', [room.id]);
  return json({ data: formatPlayback(updated) });
}

async function handleWatchRoomMessage(request, env, currentUser, code) {
  const room = await first(env.DB, 'SELECT * FROM watch_rooms WHERE code = ?', [String(code).trim().toUpperCase()]);
  if (!room) {
    return json({ message: 'Room not found.' }, 404);
  }

  const member = await roomMembership(env, room.id, currentUser.id);
  if (!member) {
    return json({ message: 'Join the room first.' }, 403);
  }

  const body = await parseJson(request);
  if (body instanceof Response) {
    return body;
  }

  const text = String(body.body || '').trim();
  const kind = body.kind === 'note' ? 'note' : 'chat';

  if (!text) {
    return validationError({
      message: 'Message text is required.',
      errors: {
        body: ['Message text is required.'],
      },
    });
  }

  const insert = await run(
    env.DB,
    'INSERT INTO watch_room_messages (watch_room_id, user_id, kind, body, created_at) VALUES (?, ?, ?, ?, ?)',
    [room.id, currentUser.id, kind, text, nowIso()],
  );

  await upsertRoomMember(env, room.id, currentUser.id);
  const message = await first(env.DB, 'SELECT * FROM watch_room_messages WHERE id = ?', [insert.meta.last_row_id]);
  return json({ data: await formatRoomMessage(env, message) }, 201);
}

async function handleAcceptWatchRoomInvite(env, currentUser, inviteId) {
  const invite = await first(env.DB, 'SELECT * FROM watch_room_invites WHERE id = ?', [inviteId]);
  if (!invite) {
    return json({ message: 'Invite not found.' }, 404);
  }

  if (Number(invite.recipient_user_id) !== Number(currentUser.id)) {
    return json({ message: 'You cannot accept this invite.' }, 403);
  }

  if (invite.status !== 'pending') {
    return json({ message: 'Invite is no longer pending.' }, 422);
  }

  await upsertRoomMember(env, invite.watch_room_id, currentUser.id);
  await run(
    env.DB,
    'UPDATE watch_room_invites SET status = ?, responded_at = ?, updated_at = ? WHERE id = ?',
    ['accepted', nowIso(), nowIso(), inviteId],
  );
  await appendSystemMessage(env, invite.watch_room_id, currentUser.id, `${currentUser.name} принял приглашение.`);

  await ensureRoomVideoSource(
    env,
    await first(env.DB, 'SELECT * FROM watch_rooms WHERE id = ?', [invite.watch_room_id]),
  );

  return json({ data: await formatWatchRoom(env, invite.watch_room_id, currentUser.id) });
}

async function handleRejectWatchRoomInvite(env, currentUser, inviteId) {
  const invite = await first(env.DB, 'SELECT * FROM watch_room_invites WHERE id = ?', [inviteId]);
  if (!invite) {
    return json({ message: 'Invite not found.' }, 404);
  }

  if (Number(invite.recipient_user_id) !== Number(currentUser.id)) {
    return json({ message: 'You cannot reject this invite.' }, 403);
  }

  if (invite.status !== 'pending') {
    return json({ message: 'Invite is no longer pending.' }, 422);
  }

  await run(
    env.DB,
    'UPDATE watch_room_invites SET status = ?, responded_at = ?, updated_at = ? WHERE id = ?',
    ['rejected', nowIso(), nowIso(), inviteId],
  );

  return json({ message: 'Приглашение отклонено.' });
}

async function listFriends(env, userId) {
  const friendships = await all(
    env.DB,
    'SELECT * FROM friendships WHERE status = ? AND (user_one_id = ? OR user_two_id = ?) ORDER BY updated_at DESC',
    ['accepted', userId, userId],
  );

  const friends = [];
  for (const friendship of friendships) {
    friends.push(await formatFriend(env, friendship, userId));
  }

  return friends;
}

async function listFriendRequests(env, userId) {
  const friendships = await all(
    env.DB,
    'SELECT * FROM friendships WHERE status = ? AND (user_one_id = ? OR user_two_id = ?) ORDER BY created_at DESC',
    ['pending', userId, userId],
  );

  const incoming = [];
  const outgoing = [];

  for (const friendship of friendships) {
    const formatted = await formatFriendRequest(env, friendship, userId);
    if (formatted.direction === 'incoming') {
      incoming.push(formatted);
    } else {
      outgoing.push(formatted);
    }
  }

  return { incoming, outgoing };
}

async function listNotes(env, userId) {
  const [ownRows, incomingRows] = await Promise.all([
    all(env.DB, `${NOTE_SELECT_SQL} WHERE n.user_id = ? ORDER BY n.created_at DESC`, [userId]),
    all(env.DB, `${NOTE_SELECT_SQL} WHERE n.sent_to = ? ORDER BY n.created_at DESC`, [userId]),
  ]);

  const own = await Promise.all(ownRows.map((note) => formatNote(env, note)));
  const incoming = await Promise.all(incomingRows.map((note) => formatNote(env, note)));

  return { incoming, own };
}

async function listWatchRooms(env, userId) {
  const rooms = await all(
    env.DB,
    `SELECT DISTINCT wr.*
     FROM watch_rooms wr
     LEFT JOIN watch_room_members m ON m.watch_room_id = wr.id
     WHERE wr.host_user_id = ? OR m.user_id = ?
     ORDER BY wr.updated_at DESC`,
    [userId, userId],
  );

  const summaries = [];
  for (const room of rooms) {
    summaries.push(await formatWatchRoomSummary(env, await ensureRoomVideoSource(env, room), userId));
  }
  return summaries;
}

async function ensureRoomVideoSource(env, room) {
  return room;
}

async function listWatchRoomInvites(env, userId) {
  const [incomingRows, outgoingRows] = await Promise.all([
    all(
      env.DB,
      'SELECT * FROM watch_room_invites WHERE recipient_user_id = ? AND status = ? ORDER BY created_at DESC',
      [userId, 'pending'],
    ),
    all(
      env.DB,
      'SELECT * FROM watch_room_invites WHERE sender_user_id = ? AND status = ? ORDER BY created_at DESC',
      [userId, 'pending'],
    ),
  ]);

  return {
    incoming: await Promise.all(incomingRows.map((invite) => formatWatchRoomInvite(env, invite, userId))),
    outgoing: await Promise.all(outgoingRows.map((invite) => formatWatchRoomInvite(env, invite, userId))),
  };
}

async function formatAuthUser(env, user) {
  const notesRow = await first(env.DB, 'SELECT COUNT(*) AS count FROM notes WHERE user_id = ?', [user.id]);
  const friendsRow = await first(
    env.DB,
    'SELECT COUNT(*) AS count FROM friendships WHERE status = ? AND (user_one_id = ? OR user_two_id = ?)',
    ['accepted', user.id, user.id],
  );
  const roomsRow = await first(
    env.DB,
    `SELECT COUNT(*) AS count
     FROM (
       SELECT DISTINCT wr.id
       FROM watch_rooms wr
       LEFT JOIN watch_room_members m ON m.watch_room_id = wr.id
       WHERE wr.host_user_id = ? OR m.user_id = ?
     ) rooms`,
    [user.id, user.id],
  );

  return {
    id: Number(user.id),
    name: user.name,
    email: user.email,
    username: user.username || null,
    bio: user.bio || '',
    avatarUrl: user.avatar_url || null,
    avatarTheme: normalizeAvatarTheme(user.avatar_theme),
    emailVerifiedAt: user.email_verified_at || null,
    isEmailVerified: Boolean(user.email_verified_at),
    stats: {
      rooms: Number(roomsRow?.count || 0),
      notes: Number(notesRow?.count || 0),
      friends: Number(friendsRow?.count || 0),
    },
  };
}

async function formatFriend(env, friendship, viewerId) {
  const otherUserId =
    Number(friendship.user_one_id) === Number(viewerId) ? friendship.user_two_id : friendship.user_one_id;
  const otherUser = await getUserById(env, otherUserId);

  return {
    ...personPreview(otherUser),
    bio: otherUser?.bio || '',
    friendshipId: Number(friendship.id),
  };
}

async function formatFriendRequest(env, friendship, viewerId) {
  const otherUserId =
    Number(friendship.user_one_id) === Number(viewerId) ? friendship.user_two_id : friendship.user_one_id;
  const otherUser = await getUserById(env, otherUserId);

  return {
    id: Number(friendship.id),
    direction: Number(friendship.requested_by_id) === Number(viewerId) ? 'outgoing' : 'incoming',
    status: friendship.status,
    user: personPreview(otherUser),
    createdAt: friendship.created_at || null,
  };
}

async function formatNote(env, note) {
  let owner = null;
  let recipient = null;

  if (note.owner_id != null || note.owner_name != null) {
    owner = {
      id: Number(note.owner_id),
      name: note.owner_name,
      email: note.owner_email,
      username: note.owner_username,
      avatar_url: note.owner_avatar_url,
      avatar_theme: note.owner_avatar_theme,
    };
  } else {
    owner = await getUserById(env, note.user_id);
  }

  if (note.recipient_id != null || note.recipient_name != null) {
    recipient = {
      id: Number(note.recipient_id),
      name: note.recipient_name,
      email: note.recipient_email,
      username: note.recipient_username,
      avatar_url: note.recipient_avatar_url,
      avatar_theme: note.recipient_avatar_theme,
    };
  } else if (note.sent_to) {
    recipient = await getUserById(env, note.sent_to);
  }

  return {
    id: Number(note.id),
    mediaType: normalizeMediaType(note.media_type),
    tmdbId: Number(note.tmdb_id),
    movieTitle: note.movie_title,
    posterPath: note.poster_path || null,
    posterUrl: imageUrl(note.poster_path),
    releaseYear: note.release_year == null ? null : Number(note.release_year),
    noteText: note.note_text,
    status: note.status,
    owner: owner ? personPreview(owner) : null,
    recipient: recipient ? personPreview(recipient) : null,
    sentAt: note.sent_at || null,
    respondedAt: note.responded_at || null,
    createdAt: note.created_at || null,
  };
}

async function formatWatchRoomSummary(env, room, viewerId) {
  const host = await getUserById(env, room.host_user_id);
  const memberCountRow = await first(
    env.DB,
    'SELECT COUNT(*) AS count FROM watch_room_members WHERE watch_room_id = ?',
    [room.id],
  );
  const share = buildRoomSharePayload(room);
  const source = describeVideoSource(room.video_url);

  return {
    code: room.code,
    host: host ? personPreview(host) : null,
    isHost: Number(room.host_user_id) === Number(viewerId),
    hasVideoSource: Boolean(room.video_url),
    mediaType: normalizeMediaType(room.media_type),
    memberCount: Math.max(1, Number(memberCountRow?.count || 0)),
    movieTitle: room.movie_title,
    playback: formatPlayback(room),
    posterPath: room.poster_path || null,
    posterUrl: imageUrl(room.poster_path),
    releaseYear: room.release_year == null ? null : Number(room.release_year),
    share,
    source,
    updatedAt: room.updated_at || null,
  };
}

async function formatWatchRoom(env, roomId, viewerId) {
  const room = await first(env.DB, 'SELECT * FROM watch_rooms WHERE id = ?', [roomId]);
  const summary = await formatWatchRoomSummary(env, room, viewerId);
  const memberRows = await all(
    env.DB,
    `SELECT m.last_seen_at, u.id, u.name, u.email, u.username, u.avatar_url, u.avatar_theme
     FROM watch_room_members m
     JOIN users u ON u.id = m.user_id
     WHERE m.watch_room_id = ?
     ORDER BY CASE WHEN u.id = ? THEN 0 ELSE 1 END, u.name COLLATE NOCASE ASC`,
    [roomId, room.host_user_id],
  );
  const messageRows = await all(
    env.DB,
    `SELECT *
     FROM (
       SELECT * FROM watch_room_messages WHERE watch_room_id = ? ORDER BY created_at DESC LIMIT ?
     )
     ORDER BY created_at ASC`,
    [roomId, ROOM_MESSAGE_LIMIT],
  );

  const members = memberRows.map((member) => ({
    ...personPreview(member),
    lastSeenAt: member.last_seen_at || null,
  }));

  const messages = [];
  for (const message of messageRows) {
    messages.push(await formatRoomMessage(env, message));
  }

  return {
    ...summary,
    tmdbId: room.tmdb_id == null ? null : Number(room.tmdb_id),
    videoUrl: room.video_url || null,
    members,
    messages,
  };
}

async function formatWatchRoomInvite(env, invite, viewerId) {
  const room = await first(env.DB, 'SELECT * FROM watch_rooms WHERE id = ?', [invite.watch_room_id]);
  const sender = await getUserById(env, invite.sender_user_id);
  const recipient = await getUserById(env, invite.recipient_user_id);

  return {
    id: Number(invite.id),
    status: invite.status,
    createdAt: invite.created_at || null,
    respondedAt: invite.responded_at || null,
    room: await formatWatchRoomSummary(env, room, viewerId),
    sender: sender ? personPreview(sender) : null,
    recipient: recipient ? personPreview(recipient) : null,
  };
}

async function formatRoomMessage(env, message) {
  const user = await getUserById(env, message.user_id);
  return {
    id: Number(message.id),
    kind: normalizeRoomMessageKind(message.kind),
    body: message.body,
    createdAt: message.created_at || null,
    user: user ? personPreview(user) : null,
  };
}

async function formatProfileListItem(env, user, viewerId) {
  const relationship = await resolveUserRelationship(env, viewerId, user.id);

  return {
    ...personPreview(user),
    bio: user.bio || '',
    relationship,
  };
}

async function formatPublicUserProfile(env, user, viewerId) {
  const profile = await formatAuthUser(env, user);
  const relationship =
    Number(user.id) === Number(viewerId)
      ? { friendshipId: null, status: 'self' }
      : await resolveUserRelationship(env, viewerId, user.id);

  return {
    ...profile,
    relationship,
  };
}

function formatPlayback(room) {
  return {
    lastSyncedAt: room.last_synced_at || null,
    lastSyncedByUserId: room.last_synced_by_user_id == null ? null : Number(room.last_synced_by_user_id),
    positionMs: Number(room.playback_position_ms || 0),
    rate: Number(room.playback_rate || 1),
    state: room.playback_state || 'paused',
  };
}

async function tmdbRequest(env, path, params) {
  const primaryApiKey = String(env.TMDB_API_KEY || '').trim();
  const apiKeys = [...new Set([primaryApiKey, TMDB_API_KEY_FALLBACK].filter(Boolean))];
  if (apiKeys.length === 0) {
    throw new Error('TMDB_API_KEY binding is missing.');
  }

  let lastError = null;
  for (const apiKey of apiKeys) {
    const url = new URL(`${TMDB_API_BASE_URL}${path}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value == null || value === '') {
        return;
      }

      url.searchParams.set(key, String(value));
    });
    url.searchParams.set('api_key', apiKey);

    try {
      const response = await fetch(url.toString(), {
        headers: {
          accept: 'application/json',
        },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`TMDB request failed (${response.status}): ${text}`);
      }

      return response.json();
    } catch (error) {
      lastError = error;
      console.error('TMDB request attempt failed', path, error);
    }
  }

  throw lastError || new Error('TMDB request failed.');
}

function mapTmdbSummary(item, mediaType) {
  const normalizedMediaType = normalizeMediaType(mediaType || item.media_type);
  const releaseDate = normalizedMediaType === 'tv' ? item.first_air_date : item.release_date;

  return {
    id: Number(item.id),
    mediaType: normalizedMediaType,
    title: item.title || item.name || 'Без названия',
    overview: item.overview || '',
    posterPath: item.poster_path || null,
    posterUrl: imageUrl(item.poster_path),
    releaseYear: extractYear(releaseDate),
    rating: typeof item.vote_average === 'number' ? item.vote_average : null,
    mediaLabel: normalizedMediaType === 'tv' ? 'Сериал' : 'Фильм',
  };
}

function mapTmdbDetails(item, mediaType) {
  const summary = mapTmdbSummary(item, mediaType);
  const runtime =
    mediaType === 'tv'
      ? Array.isArray(item.episode_run_time)
        ? item.episode_run_time.find((value) => Number.isFinite(value)) || null
        : null
      : item.runtime == null
        ? null
        : Number(item.runtime);

  return {
    ...summary,
    backdropPath: item.backdrop_path || null,
    backdropUrl: imageUrl(item.backdrop_path),
    episodeCount:
      mediaType === 'tv' && Number.isFinite(item.number_of_episodes) ? Number(item.number_of_episodes) : null,
    genres: Array.isArray(item.genres) ? item.genres.map((genre) => genre.name).filter(Boolean) : [],
    runtime,
    seasonCount:
      mediaType === 'tv' && Number.isFinite(item.number_of_seasons) ? Number(item.number_of_seasons) : null,
  };
}

async function requireAuth(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();

  if (!token) {
    return json({ message: 'Authentication required.' }, 401);
  }

  const session = await first(
    env.DB,
    `SELECT s.token, u.*
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ?`,
    [token],
  );

  if (!session) {
    return json({ message: 'Session expired.' }, 401);
  }

  return {
    token,
    user: {
      id: Number(session.id),
      name: session.name,
      email: session.email,
      username: session.username,
      bio: session.bio,
      avatar_url: session.avatar_url,
      avatar_theme: session.avatar_theme,
      email_verified_at: session.email_verified_at,
      email_verification_code_hash: session.email_verification_code_hash,
      email_verification_sent_at: session.email_verification_sent_at,
      email_verification_expires_at: session.email_verification_expires_at,
      password_hash: session.password_hash,
      created_at: session.created_at,
      updated_at: session.updated_at,
    },
  };
}

async function getUserById(env, userId) {
  if (!userId) {
    return null;
  }

  return first(
    env.DB,
    `SELECT
       id,
       name,
       email,
       username,
       bio,
       avatar_url,
       avatar_theme,
       email_verified_at,
       email_verification_code_hash,
       email_verification_sent_at,
       email_verification_expires_at,
       password_hash,
       created_at,
       updated_at
     FROM users
     WHERE id = ?`,
    [Number(userId)],
  );
}

async function usersAreFriends(env, firstUserId, secondUserId) {
  const [userOneId, userTwoId] = pairUserIds(firstUserId, secondUserId);
  const rowValue = await first(
    env.DB,
    'SELECT id FROM friendships WHERE user_one_id = ? AND user_two_id = ? AND status = ?',
    [userOneId, userTwoId, 'accepted'],
  );
  return Boolean(rowValue);
}

async function resolveUserRelationship(env, viewerId, profileUserId) {
  if (Number(viewerId) === Number(profileUserId)) {
    return {
      friendshipId: null,
      status: 'self',
    };
  }

  const [userOneId, userTwoId] = pairUserIds(viewerId, profileUserId);
  const friendship = await first(
    env.DB,
    'SELECT id, requested_by_id, status FROM friendships WHERE user_one_id = ? AND user_two_id = ?',
    [userOneId, userTwoId],
  );

  if (!friendship) {
    return {
      friendshipId: null,
      status: 'none',
    };
  }

  if (friendship.status === 'accepted') {
    return {
      friendshipId: Number(friendship.id),
      status: 'friend',
    };
  }

  return {
    friendshipId: Number(friendship.id),
    status:
      Number(friendship.requested_by_id) === Number(viewerId) ? 'outgoing_request' : 'incoming_request',
  };
}

function canRespondToFriendship(friendship, userId) {
  if (!friendship || friendship.status !== 'pending') {
    return false;
  }

  const isParticipant =
    Number(friendship.user_one_id) === Number(userId) || Number(friendship.user_two_id) === Number(userId);
  const isRequester = Number(friendship.requested_by_id) === Number(userId);

  return isParticipant && !isRequester;
}

async function upsertRoomMember(env, roomId, userId) {
  const timestamp = nowIso();
  await run(
    env.DB,
    `INSERT INTO watch_room_members (watch_room_id, user_id, last_seen_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(watch_room_id, user_id) DO UPDATE SET
       last_seen_at = excluded.last_seen_at,
       updated_at = excluded.updated_at`,
    [roomId, userId, timestamp, timestamp, timestamp],
  );
}

async function appendSystemMessage(env, roomId, actorUserId, body) {
  const text = String(body || '').trim();
  if (!text) {
    return;
  }

  await run(
    env.DB,
    'INSERT INTO watch_room_messages (watch_room_id, user_id, kind, body, created_at) VALUES (?, ?, ?, ?, ?)',
    [roomId, actorUserId, 'system', text, nowIso()],
  );
}

async function roomMembership(env, roomId, userId) {
  const rowValue = await first(
    env.DB,
    'SELECT * FROM watch_room_members WHERE watch_room_id = ? AND user_id = ?',
    [roomId, userId],
  );
  if (rowValue) {
    return rowValue;
  }

  const room = await first(env.DB, 'SELECT host_user_id FROM watch_rooms WHERE id = ?', [roomId]);
  if (room && Number(room.host_user_id) === Number(userId)) {
    return { watch_room_id: roomId, user_id: userId };
  }

  return null;
}

function validateNotePayload(body) {
  const tmdbId = Number(body.tmdb_id);
  const movieTitle = String(body.movie_title || '').trim();
  const noteText = String(body.note_text || '').trim();

  if (!Number.isFinite(tmdbId) || !movieTitle || !noteText) {
    return validationError({
      message: 'Movie, title, and note text are required.',
      errors: {
        tmdb_id: !Number.isFinite(tmdbId) ? ['tmdb_id is required.'] : undefined,
        movie_title: !movieTitle ? ['movie_title is required.'] : undefined,
        note_text: !noteText ? ['note_text is required.'] : undefined,
      },
    });
  }

  return {
    tmdb_id: tmdbId,
    media_type: normalizeMediaType(body.media_type),
    movie_title: movieTitle,
    poster_path: body.poster_path ? String(body.poster_path) : null,
    release_year: body.release_year == null ? null : Number(body.release_year),
    note_text: noteText,
  };
}

async function createSession(env, userId) {
  const token = randomToken();
  await run(env.DB, 'INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)', [
    token,
    userId,
    nowIso(),
  ]);
  return token;
}

async function hashValue(env, value) {
  const encoder = new TextEncoder();
  const pepper = String(env.AUTH_PEPPER || env.APP_NAME || APP_SCHEME).trim();
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`${pepper}:${String(value || '')}`));
  return Array.from(new Uint8Array(digest), (item) => item.toString(16).padStart(2, '0')).join('');
}

async function verifyHashedValue(env, plainValue, hashedValue) {
  const actualHash = await hashValue(env, plainValue);
  return timingSafeEqual(actualHash, String(hashedValue || ''));
}

async function hashPassword(password) {
  const salt = randomToken(16);
  const hash = await derivePasswordHash(password, salt);
  return `pbkdf2_sha256$100000$${salt}$${hash}`;
}

async function verifyPassword(password, encoded) {
  const parts = String(encoded || '').split('$');
  if (parts.length !== 4) {
    return false;
  }

  const [, iterations, salt, expectedHash] = parts;
  if (iterations !== '100000') {
    return false;
  }

  const actualHash = await derivePasswordHash(password, salt);
  return timingSafeEqual(actualHash, expectedHash);
}

async function derivePasswordHash(password, salt) {
  const encoder = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: 100000,
      salt: encoder.encode(salt),
    },
    baseKey,
    256,
  );

  return bytesToBase64Url(new Uint8Array(bits));
}

function timingSafeEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

async function sendVerificationCodeEmail(env, payload) {
  const apiKey = String(env.RESEND_API_KEY || '').trim();
  const fromEmail = String(env.RESEND_FROM_EMAIL || '').trim();
  const appName = String(env.APP_NAME || 'Cinema Notes').trim();
  const safeName = escapeHtml(payload.name || 'friend');
  const html = `
    <div style="font-family: Arial, sans-serif; background: #0e1320; color: #f5f7fb; padding: 24px;">
      <div style="max-width: 520px; margin: 0 auto; background: #151d30; border: 1px solid #27324b; border-radius: 20px; padding: 24px;">
        <p style="margin: 0 0 12px; color: #52C8FF; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">${escapeHtml(appName)}</p>
        <h1 style="margin: 0 0 16px; font-size: 24px;">Подтверждение email</h1>
        <p style="margin: 0 0 16px; line-height: 1.6;">Привет, ${safeName}. Введите этот код в приложении, чтобы завершить регистрацию.</p>
        <div style="margin: 0 0 16px; padding: 18px; border-radius: 16px; background: #1b2740; text-align: center; font-size: 32px; font-weight: 700; letter-spacing: 8px;">
          ${escapeHtml(payload.code)}
        </div>
        <p style="margin: 0; color: #a7b2c8; line-height: 1.6;">Код действует 15 минут. Если вы его не запрашивали, просто проигнорируйте это письмо.</p>
      </div>
    </div>
  `.trim();

  if (apiKey && fromEmail) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [payload.email],
          subject: `${appName}: код подтверждения ${payload.code}`,
          html,
        }),
      });

      if (response.ok) {
        return { debugCode: null };
      }

      console.error('Resend email request failed', response.status, await response.text());
    } catch (error) {
      console.error('Unable to send verification email', error);
    }
  }

  console.warn('Verification email provider is not configured. Returning debug code instead.');
  return {
    debugCode: payload.code,
  };
}

function personPreview(user) {
  if (!user) {
    return null;
  }

  return {
    id: Number(user.id),
    name: user.name,
    email: user.email,
    username: user.username || null,
    avatarUrl: user.avatar_url || null,
    avatarTheme: normalizeAvatarTheme(user.avatar_theme),
  };
}

function normalizeVerificationCode(value) {
  const code = String(value || '').replace(/\D+/g, '').slice(0, 6);
  return code.length === 6 ? code : '';
}

function generateVerificationCode() {
  const numberValue = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return String(numberValue).padStart(6, '0');
}

function sanitizeUsername(value) {
  const sanitized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, '_')
    .replace(/^[._]+|[._]+$/g, '')
    .replace(/[._]{2,}/g, '_')
    .slice(0, USERNAME_MAX_LENGTH);

  return sanitized;
}

async function buildUniqueUsername(env, rawValue, currentUserId = null) {
  let base = sanitizeUsername(rawValue);
  if (base.length < USERNAME_MIN_LENGTH) {
    base = `user_${randomToken(3)}`;
  }

  const trimmedBase = base.slice(0, USERNAME_MAX_LENGTH);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = attempt === 0 ? '' : `${Math.floor(Math.random() * 900 + 100)}`;
    const candidate = `${trimmedBase.slice(0, USERNAME_MAX_LENGTH - suffix.length)}${suffix}`;
    const existing = await first(
      env.DB,
      'SELECT id FROM users WHERE LOWER(username) = ? AND (? IS NULL OR id != ?)',
      [candidate.toLowerCase(), currentUserId, currentUserId],
    );
    if (!existing) {
      return candidate;
    }
  }

  return `user_${randomToken(4)}`;
}

function pickAvatarTheme(seedValue) {
  const themes = ['sunset', 'ocean', 'violet', 'mint', 'ember', 'midnight'];
  const seed = String(seedValue || '');
  const index =
    Array.from(seed).reduce((sum, symbol) => sum + symbol.charCodeAt(0), 0) % themes.length;

  return themes[index];
}

function normalizeAvatarTheme(value) {
  const theme = String(value || '').trim().toLowerCase();
  const allowedThemes = new Set(['sunset', 'ocean', 'violet', 'mint', 'ember', 'midnight']);
  return allowedThemes.has(theme) ? theme : DEFAULT_AVATAR_THEME;
}

function normalizeAvatarUrl(value) {
  if (value == null) {
    return null;
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }

  if (
    /^data:image\/(?:png|jpeg|jpg|webp);base64,[a-z0-9+/=\s]+$/i.test(trimmed) &&
    trimmed.length <= MAX_AVATAR_URL_LENGTH
  ) {
    return trimmed;
  }

  if (isValidUrl(trimmed)) {
    return trimmed;
  }

  return false;
}

function normalizeVideoSourceInput(value) {
  const videoUrl = String(value || '').trim();
  if (!videoUrl) {
    return {
      source: describeVideoSource(''),
      url: '',
    };
  }

  if (!isValidUrl(videoUrl)) {
    return false;
  }

  const normalizedUrl = normalizeVideoUrl(videoUrl);
  return {
    source: describeVideoSource(normalizedUrl),
    url: normalizedUrl,
  };
}

function normalizeVideoUrl(value) {
  const trimmed = String(value || '').trim();
  const youtubeId = getYouTubeVideoId(trimmed);
  if (youtubeId) {
    return `https://www.youtube.com/watch?v=${youtubeId}`;
  }

  return trimmed;
}

function describeVideoSource(value) {
  const videoUrl = String(value || '').trim();
  if (!videoUrl) {
    return {
      embedUrl: null,
      embeddable: false,
      kind: 'none',
      label: 'Видео подбирается автоматически',
      provider: null,
      videoId: null,
    };
  }

  const youtubeVideoId = getYouTubeVideoId(videoUrl);
  if (youtubeVideoId) {
    return {
      embedUrl: `https://www.youtube.com/watch?v=${youtubeVideoId}`,
      embeddable: false,
      kind: 'youtube',
      label: 'YouTube (внешний источник)',
      provider: 'YouTube',
      videoId: youtubeVideoId,
    };
  }

  try {
    const parsedUrl = new URL(videoUrl);
    const pathname = parsedUrl.pathname.toLowerCase();
    const isDirectVideo = /\.(mp4|m3u8|webm|mov|m4v)(?:$|[?#])/i.test(pathname);

    if (isDirectVideo) {
      return {
        embedUrl: videoUrl,
        embeddable: true,
        kind: 'direct',
        label: 'Прямое видео',
        provider: parsedUrl.hostname.replace(/^www\./, ''),
        videoId: null,
      };
    }

    return {
      embedUrl: null,
      embeddable: false,
      kind: 'external',
      label: parsedUrl.hostname.replace(/^www\./, ''),
      provider: parsedUrl.hostname.replace(/^www\./, ''),
      videoId: null,
    };
  } catch {
    return {
      embedUrl: null,
      embeddable: false,
      kind: 'external',
      label: 'Внешний сайт',
      provider: 'external',
      videoId: null,
    };
  }
}

function buildRoomDeepLink(code) {
  return `${APP_SCHEME}://watch/${encodeURIComponent(String(code || '').trim().toUpperCase())}`;
}

function buildRoomInviteMessage(room) {
  const safeCode = String(room.code || '').trim().toUpperCase();
  const title = String(room.movie_title || room.movieTitle || 'shared watch').trim();
  const deepLink = buildRoomDeepLink(safeCode);
  const directSource = String(room.video_url || room.videoUrl || '').trim();

  const parts = [
    'Привет! Приглашаю тебя на совместный просмотр в Cinema Notes.',
    `Что смотрим: ${title}`,
    `Код комнаты: ${safeCode}`,
    `Открыть комнату: ${deepLink}`,
  ];

  if (directSource) {
    parts.push(`Источник: ${directSource}`);
  }

  return parts.join('\n');
}

function buildRoomSharePayload(room) {
  const deepLink = buildRoomDeepLink(room.code);

  return {
    deepLink,
    inviteText: buildRoomInviteMessage(room),
  };
}

function normalizeRoomMessageKind(value) {
  if (value === 'note') {
    return 'note';
  }

  if (value === 'system') {
    return 'system';
  }

  return 'chat';
}

function normalizeSearchSpaces(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeSearchText(value) {
  return normalizeSearchSpaces(
    String(value || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
      .replace(/\s+/g, ' '),
  );
}

function buildAutoVideoSearchQueries(input) {
  const cleanTitle = normalizeSearchSpaces(input.title);
  const withYear = input.releaseYear ? `${cleanTitle} ${input.releaseYear}` : cleanTitle;
  const queries =
    input.mediaType === 'tv'
      ? [
          `${withYear} episode 1`,
          `${withYear} season 1 episode 1`,
          `${withYear} 1 сезон 1 серия`,
          `${withYear} anime episode 1`,
          withYear,
        ]
      : [
          `${withYear} full movie`,
          `${withYear} фильм полностью`,
          `${withYear} movie`,
          withYear,
        ];

  return [...new Set(queries.map(normalizeSearchSpaces).filter(Boolean))];
}

function parseDurationTextToSeconds(value) {
  if (!value) {
    return null;
  }

  const parts = String(value)
    .trim()
    .split(':')
    .map((part) => Number(part))
    .filter((part) => Number.isFinite(part));

  if (parts.length < 2 || parts.length > 3) {
    return null;
  }

  return parts.reduce((total, part) => total * 60 + part, 0);
}

function stableVideoIdHash(videoId) {
  let hash = 0;
  for (let index = 0; index < String(videoId || '').length; index += 1) {
    hash = (hash * 31 + String(videoId).charCodeAt(index)) >>> 0;
  }

  return hash || String(videoId || '').length;
}

function extractAutoVideoTitle(renderer) {
  const titleValue = renderer?.title;
  if (titleValue?.simpleText) {
    return titleValue.simpleText;
  }

  if (Array.isArray(titleValue?.runs)) {
    return titleValue.runs.map((item) => item?.text || '').join('');
  }

  return '';
}

function extractAutoVideoDuration(renderer) {
  return parseDurationTextToSeconds(renderer?.lengthText?.simpleText);
}

function extractAutoVideoCandidates(payload) {
  const results = [];

  const visit = (node) => {
    if (!node || typeof node !== 'object' || results.length >= MAX_AUTO_VIDEO_CANDIDATES) {
      return;
    }

    const videoRenderer = node.videoRenderer;
    if (videoRenderer?.videoId) {
      const title = extractAutoVideoTitle(videoRenderer);
      if (title) {
        results.push({
          durationSeconds: extractAutoVideoDuration(videoRenderer),
          title,
          videoId: String(videoRenderer.videoId),
        });
      }
    }

    Object.values(node).forEach((value) => {
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }

      visit(value);
    });
  };

  visit(payload);
  return results;
}

function scoreAutoVideoCandidate(candidate, input, query) {
  const normalizedTitle = normalizeSearchText(candidate.title);
  const normalizedQuery = normalizeSearchText(query);
  const requestedTokens = normalizeSearchText(input.title)
    .split(' ')
    .filter((token) => token.length >= 3);

  let score = 0;

  requestedTokens.forEach((token) => {
    if (normalizedTitle.includes(token)) {
      score += 14;
    }
  });

  if (normalizedTitle.includes(normalizedQuery)) {
    score += 18;
  }

  if (input.releaseYear && normalizedTitle.includes(String(input.releaseYear))) {
    score += 8;
  }

  if (input.mediaType === 'movie') {
    if ((candidate.durationSeconds || 0) >= 5400) {
      score += 34;
    } else if ((candidate.durationSeconds || 0) >= 3600) {
      score += 28;
    } else if ((candidate.durationSeconds || 0) >= 2400) {
      score += 18;
    } else if ((candidate.durationSeconds || 0) < 600) {
      score -= 24;
    }

    if (/(full movie|movie|film|фильм|полностью)/i.test(candidate.title)) {
      score += 18;
    }
  } else {
    if ((candidate.durationSeconds || 0) >= 1200 && (candidate.durationSeconds || 0) <= 3600) {
      score += 28;
    } else if ((candidate.durationSeconds || 0) >= 600) {
      score += 16;
    } else {
      score -= 20;
    }

    if (/(episode|ep\b|серия|season|сезон|anime)/i.test(candidate.title)) {
      score += 18;
    }
  }

  if (
    /(trailer|тизер|teaser|opening|ending|amv|ost|review|reaction|обзор|clip|shorts?)/i.test(
      candidate.title,
    )
  ) {
    score -= 30;
  }

  return score;
}

async function searchYouTubeCandidates(query) {
  const url = new URL('https://www.youtube.com/results');
  url.searchParams.set('hl', 'ru');
  url.searchParams.set('search_query', query);

  const response = await fetch(url.toString(), {
    headers: {
      accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(VIDEO_SEARCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`YouTube search failed (${response.status}).`);
  }

  const html = await response.text();
  const match = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
  if (!match?.[1]) {
    return [];
  }

  return extractAutoVideoCandidates(JSON.parse(match[1]));
}

async function resolveAutoVideoUrl(input) {
  return null;
}

async function searchAutoVideoCatalog(query) {
  const normalizedSource = normalizeVideoSourceInput(query);
  if (normalizedSource === false || !normalizedSource?.url) {
    return [];
  }

  const source = normalizedSource.source;
  const sourceKind =
    source.kind === 'youtube'
      ? 'youtube'
      : source.kind === 'direct'
        ? 'direct'
        : 'external';

  return [
    {
      id: stableVideoIdHash(source.videoId || normalizedSource.url),
      mediaLabel: 'Видео',
      mediaType: 'movie',
      overview:
        source.kind === 'direct'
          ? 'Прямая ссылка на видео. Такой источник можно открыть в комнате без отдельного поиска.'
          : `Источник по ссылке: ${source.label}.`,
      posterPath: null,
      posterUrl: source.videoId ? `https://i.ytimg.com/vi/${source.videoId}/hqdefault.jpg` : null,
      rating: null,
      releaseYear: null,
      sourceKind,
      sourceLabel: source.label,
      sourceProvider: source.provider || null,
      title: source.kind === 'youtube' ? 'Видео YouTube' : 'Видео по ссылке',
      videoUrl: normalizedSource.url,
    },
  ];
}

function dedupeMovieResults(results) {
  const seen = new Set();

  return results.filter((item) => {
    const key = item?.videoUrl
      ? `video:${item.videoUrl}`
      : `${normalizeMediaType(item?.mediaType)}:${Number(item?.id || 0)}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getYouTubeVideoId(value) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(String(value).trim());
    const host = url.hostname.replace(/^www\./, '').toLowerCase();

    if (host === 'youtu.be') {
      return url.pathname.replace(/^\/+/, '').slice(0, 11) || null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (url.pathname === '/watch') {
        return url.searchParams.get('v')?.slice(0, 11) || null;
      }

      const pathMatch = url.pathname.match(/^\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})/);
      if (pathMatch) {
        return pathMatch[1];
      }
    }
  } catch {
    return null;
  }

  return null;
}

function escapeLikeValue(value) {
  return String(value || '').replace(/[\\%_]/g, '\\$&');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function extractYear(value) {
  const match = String(value || '').match(/^\d{4}/);
  return match ? Number(match[0]) : null;
}

function imageUrl(path) {
  if (!path) {
    return null;
  }

  return `${TMDB_IMAGE_BASE_URL}/${String(path).replace(/^\/+/, '')}`;
}

function normalizeMediaType(value) {
  return value === 'tv' ? 'tv' : 'movie';
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function isValidUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function pairUserIds(left, right) {
  return Number(left) < Number(right) ? [Number(left), Number(right)] : [Number(right), Number(left)];
}

function randomToken(bytes = 32) {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return Array.from(value, (item) => item.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64Url(bytes) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function generateUniqueRoomCode(env) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = randomRoomCode();
    const existing = await first(env.DB, 'SELECT id FROM watch_rooms WHERE code = ?', [code]);
    if (!existing) {
      return code;
    }
  }

  throw new Error('Unable to generate a unique room code.');
}

function randomRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('');
}

async function parseJson(request) {
  try {
    return await request.json();
  } catch {
    return json({ message: 'Request body must be valid JSON.' }, 400);
  }
}

async function first(db, sql, params = []) {
  const statement = params.length ? db.prepare(sql).bind(...params) : db.prepare(sql);
  return statement.first();
}

async function all(db, sql, params = []) {
  const statement = params.length ? db.prepare(sql).bind(...params) : db.prepare(sql);
  const result = await statement.all();
  return Array.isArray(result.results) ? result.results : [];
}

async function run(db, sql, params = []) {
  const statement = params.length ? db.prepare(sql).bind(...params) : db.prepare(sql);
  return statement.run();
}

function validationError(payload) {
  return json(
    {
      errors: cleanUndefined(payload.errors || {}),
      message: payload.message || 'Validation failed.',
    },
    422,
  );
}

function cleanUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry != null));
}

function nowIso() {
  return new Date().toISOString();
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    headers: {
      ...JSON_HEADERS,
      ...CORS_HEADERS,
      ...headers,
    },
    status,
  });
}
