const JSON_HEADERS = {
  'content-type': 'application/json; charset=UTF-8',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
};

const TMDB_API_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const NOTE_SELECT_SQL = `
  SELECT
    n.*,
    owner.id AS owner_id,
    owner.name AS owner_name,
    owner.email AS owner_email,
    recipient.id AS recipient_id,
    recipient.name AS recipient_name,
    recipient.email AS recipient_email
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

  if (pathname === '/api/register' && request.method === 'POST') {
    return handleRegister(request, env);
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

  if (pathname === '/api/friends' && request.method === 'GET') {
    return json({ data: await listFriends(env, auth.user.id) });
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

  const watchSyncMatch = pathname.match(/^\/api\/watch-rooms\/([A-Za-z0-9_-]+)\/sync$/);
  if (watchSyncMatch && request.method === 'POST') {
    return handleSyncWatchRoom(request, env, auth.user, watchSyncMatch[1]);
  }

  const watchMessageMatch = pathname.match(/^\/api\/watch-rooms\/([A-Za-z0-9_-]+)\/messages$/);
  if (watchMessageMatch && request.method === 'POST') {
    return handleWatchRoomMessage(request, env, auth.user, watchMessageMatch[1]);
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

  const existing = await first(env.DB, 'SELECT id FROM users WHERE email = ?', [email]);
  if (existing) {
    return validationError({
      message: 'A user with this email already exists.',
      errors: {
        email: ['A user with this email already exists.'],
      },
    });
  }

  const timestamp = nowIso();
  const passwordHash = await hashPassword(password);
  const insert = await run(
    env.DB,
    'INSERT INTO users (name, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [name, email, passwordHash, timestamp, timestamp],
  );
  const userId = Number(insert.meta.last_row_id);
  const user = await getUserById(env, userId);
  const token = await createSession(env, userId);

  return json(
    {
      access_token: token,
      token_type: 'Bearer',
      user: await formatAuthUser(env, user),
    },
    201,
  );
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

  const token = await createSession(env, user.id);
  return json({
    access_token: token,
    token_type: 'Bearer',
    user: await formatAuthUser(env, user),
  });
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

  const payload = await tmdbRequest(env, '/search/multi', {
    include_adult: 'false',
    language: 'ru-RU',
    query,
  });

  const results = Array.isArray(payload.results)
    ? payload.results
        .filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
        .map((item) => mapTmdbSummary(item, item.media_type === 'tv' ? 'tv' : 'movie'))
    : [];

  return json({ data: results });
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

  const email = normalizeEmail(body.email);
  if (!email) {
    return validationError({
      message: 'Email is required.',
      errors: {
        email: ['Email is required.'],
      },
    });
  }

  const recipient = await first(env.DB, 'SELECT id, name, email FROM users WHERE email = ?', [email]);
  if (!recipient) {
    return validationError({
      message: 'User not found.',
      errors: {
        email: ['User with this email was not found.'],
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
  const videoUrl = String(body.video_url || '').trim();

  if (!movieTitle || !videoUrl) {
    return validationError({
      message: 'Movie title and video URL are required.',
      errors: {
        movie_title: !movieTitle ? ['Movie title is required.'] : undefined,
        video_url: !videoUrl ? ['Video URL is required.'] : undefined,
      },
    });
  }

  if (!isValidUrl(videoUrl)) {
    return validationError({
      message: 'Video URL must be a valid URL.',
      errors: {
        video_url: ['Video URL must be a valid URL.'],
      },
    });
  }

  const timestamp = nowIso();
  const code = await generateUniqueRoomCode(env);
  const mediaType = normalizeMediaType(body.media_type);
  const insert = await run(
    env.DB,
    'INSERT INTO watch_rooms (code, host_user_id, movie_title, video_url, media_type, poster_path, release_year, tmdb_id, playback_state, playback_position_ms, playback_rate, last_synced_at, last_synced_by_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      code,
      currentUser.id,
      movieTitle,
      videoUrl,
      mediaType,
      body.poster_path ? String(body.poster_path) : null,
      body.release_year ? Number(body.release_year) : null,
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
  return json({ data: await formatWatchRoom(env, roomId, currentUser.id) }, 201);
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

  await upsertRoomMember(env, room.id, currentUser.id);
  return json({ data: await formatWatchRoom(env, room.id, currentUser.id) });
}

async function handleShowWatchRoom(env, currentUser, code) {
  const room = await first(env.DB, 'SELECT * FROM watch_rooms WHERE code = ?', [String(code).trim().toUpperCase()]);
  if (!room) {
    return json({ message: 'Room not found.' }, 404);
  }

  await upsertRoomMember(env, room.id, currentUser.id);
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
    summaries.push(await formatWatchRoomSummary(env, room, userId));
  }
  return summaries;
}

async function formatAuthUser(env, user) {
  const notesRow = await first(env.DB, 'SELECT COUNT(*) AS count FROM notes WHERE user_id = ?', [user.id]);
  const friendsRow = await first(
    env.DB,
    'SELECT COUNT(*) AS count FROM friendships WHERE status = ? AND (user_one_id = ? OR user_two_id = ?)',
    ['accepted', user.id, user.id],
  );

  return {
    id: Number(user.id),
    name: user.name,
    email: user.email,
    stats: {
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
    id: Number(otherUser.id),
    name: otherUser.name,
    email: otherUser.email,
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
    };
  } else {
    owner = await getUserById(env, note.user_id);
  }

  if (note.recipient_id != null || note.recipient_name != null) {
    recipient = {
      id: Number(note.recipient_id),
      name: note.recipient_name,
      email: note.recipient_email,
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

  return {
    code: room.code,
    host: host ? personPreview(host) : null,
    isHost: Number(room.host_user_id) === Number(viewerId),
    mediaType: normalizeMediaType(room.media_type),
    memberCount: Math.max(1, Number(memberCountRow?.count || 0)),
    movieTitle: room.movie_title,
    playback: formatPlayback(room),
    posterPath: room.poster_path || null,
    posterUrl: imageUrl(room.poster_path),
    releaseYear: room.release_year == null ? null : Number(room.release_year),
    updatedAt: room.updated_at || null,
  };
}

async function formatWatchRoom(env, roomId, viewerId) {
  const room = await first(env.DB, 'SELECT * FROM watch_rooms WHERE id = ?', [roomId]);
  const summary = await formatWatchRoomSummary(env, room, viewerId);
  const memberRows = await all(
    env.DB,
    `SELECT m.last_seen_at, u.id, u.name, u.email
     FROM watch_room_members m
     JOIN users u ON u.id = m.user_id
     WHERE m.watch_room_id = ?
     ORDER BY CASE WHEN u.id = ? THEN 0 ELSE 1 END, u.name COLLATE NOCASE ASC`,
    [roomId, room.host_user_id],
  );
  const messageRows = await all(
    env.DB,
    'SELECT * FROM watch_room_messages WHERE watch_room_id = ? ORDER BY created_at ASC LIMIT 100',
    [roomId],
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
    videoUrl: room.video_url,
    members,
    messages,
  };
}

async function formatRoomMessage(env, message) {
  const user = await getUserById(env, message.user_id);
  return {
    id: Number(message.id),
    kind: message.kind === 'note' ? 'note' : 'chat',
    body: message.body,
    createdAt: message.created_at || null,
    user: user ? personPreview(user) : null,
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
  const apiKey = String(env.TMDB_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('TMDB_API_KEY binding is missing.');
  }

  const url = new URL(`${TMDB_API_BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === '') {
      return;
    }

    url.searchParams.set(key, String(value));
  });
  url.searchParams.set('api_key', apiKey);

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
}

function mapTmdbSummary(item, mediaType) {
  const normalizedMediaType = normalizeMediaType(mediaType || item.media_type);
  const releaseDate = normalizedMediaType === 'tv' ? item.first_air_date : item.release_date;

  return {
    id: Number(item.id),
    mediaType: normalizedMediaType,
    title: item.title || item.name || 'Untitled',
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
    genres: Array.isArray(item.genres) ? item.genres.map((genre) => genre.name).filter(Boolean) : [],
    runtime,
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

  return first(env.DB, 'SELECT id, name, email, password_hash, created_at, updated_at FROM users WHERE id = ?', [
    Number(userId),
  ]);
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

function personPreview(user) {
  if (!user) {
    return null;
  }

  return {
    id: Number(user.id),
    name: user.name,
    email: user.email,
  };
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
