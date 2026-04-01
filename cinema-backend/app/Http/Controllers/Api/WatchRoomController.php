<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\WatchRoom;
use App\Models\WatchRoomMember;
use App\Models\WatchRoomMessage;
use App\Services\TmdbService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class WatchRoomController extends Controller
{
    public function __construct(
        private readonly TmdbService $tmdbService,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $rooms = WatchRoom::query()
            ->where(function ($query) use ($user): void {
                $query->where('host_user_id', $user->id)
                    ->orWhereHas('members', fn ($memberQuery) => $memberQuery->where('user_id', $user->id));
            })
            ->with(['host:id,name,email', 'members.user:id,name,email'])
            ->latest()
            ->get();

        return response()->json([
            'data' => $rooms->map(fn (WatchRoom $room) => $this->formatRoomSummary($room, $user))->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'movie_title' => ['required', 'string', 'max:255'],
            'video_url' => ['required', 'url', 'max:2000'],
            'media_type' => ['nullable', 'string', 'in:movie,tv'],
            'poster_path' => ['nullable', 'string', 'max:255'],
            'release_year' => ['nullable', 'integer', 'min:1888', 'max:2100'],
            'tmdb_id' => ['nullable', 'integer'],
        ]);

        $room = WatchRoom::query()->create([
            'code' => $this->generateUniqueCode(),
            'host_user_id' => $user->id,
            'movie_title' => $validated['movie_title'],
            'video_url' => $validated['video_url'],
            'media_type' => $validated['media_type'] ?? 'movie',
            'poster_path' => $validated['poster_path'] ?? null,
            'release_year' => $validated['release_year'] ?? null,
            'tmdb_id' => $validated['tmdb_id'] ?? null,
            'playback_state' => 'paused',
            'playback_position_ms' => 0,
            'playback_rate' => 1.0,
            'last_synced_at' => now(),
            'last_synced_by_user_id' => $user->id,
        ]);

        WatchRoomMember::query()->create([
            'watch_room_id' => $room->id,
            'user_id' => $user->id,
            'last_seen_at' => now(),
        ]);

        $room->load(['host:id,name,email', 'members.user:id,name,email', 'messages.user:id,name,email']);

        return response()->json([
            'data' => $this->formatRoom($room, $user),
        ], 201);
    }

    public function join(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'code' => ['required', 'string', 'min:4', 'max:12'],
        ]);

        $room = $this->findRoomByCode($validated['code']);

        if (! $room) {
            return response()->json([
                'message' => 'Комната не найдена.',
            ], 404);
        }

        WatchRoomMember::query()->updateOrCreate(
            [
                'watch_room_id' => $room->id,
                'user_id' => $user->id,
            ],
            [
                'last_seen_at' => now(),
            ],
        );

        $room->load(['host:id,name,email', 'members.user:id,name,email', 'messages.user:id,name,email']);

        return response()->json([
            'data' => $this->formatRoom($room, $user),
        ]);
    }

    public function show(Request $request, string $code): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $room = $this->findRoomByCode($code);

        if (! $room) {
            return response()->json([
                'message' => 'Комната не найдена.',
            ], 404);
        }

        if (! $this->userInRoom($room, $user->id)) {
            WatchRoomMember::query()->create([
                'watch_room_id' => $room->id,
                'user_id' => $user->id,
                'last_seen_at' => now(),
            ]);
        } else {
            WatchRoomMember::query()
                ->where('watch_room_id', $room->id)
                ->where('user_id', $user->id)
                ->update(['last_seen_at' => now()]);
        }

        $room->refresh()->load(['host:id,name,email', 'members.user:id,name,email', 'messages.user:id,name,email']);

        return response()->json([
            'data' => $this->formatRoom($room, $user),
        ]);
    }

    public function sync(Request $request, string $code): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $room = $this->findRoomByCode($code);

        if (! $room) {
            return response()->json([
                'message' => 'Комната не найдена.',
            ], 404);
        }

        if ((int) $room->host_user_id !== (int) $user->id) {
            return response()->json([
                'message' => 'Только хозяин комнаты управляет воспроизведением.',
            ], 403);
        }

        $validated = $request->validate([
            'playback_state' => ['required', 'string', 'in:playing,paused,ended'],
            'playback_position_ms' => ['required', 'integer', 'min:0'],
            'playback_rate' => ['nullable', 'numeric', 'min:0.5', 'max:2'],
        ]);

        $room->update([
            'playback_state' => $validated['playback_state'],
            'playback_position_ms' => $validated['playback_position_ms'],
            'playback_rate' => $validated['playback_rate'] ?? $room->playback_rate,
            'last_synced_at' => now(),
            'last_synced_by_user_id' => $user->id,
        ]);

        $room->load(['host:id,name,email', 'members.user:id,name,email', 'messages.user:id,name,email']);

        return response()->json([
            'data' => $this->formatPlayback($room),
        ]);
    }

    public function sendMessage(Request $request, string $code): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $room = $this->findRoomByCode($code);

        if (! $room) {
            return response()->json([
                'message' => 'Комната не найдена.',
            ], 404);
        }

        if (! $this->userInRoom($room, $user->id)) {
            return response()->json([
                'message' => 'Сначала присоединитесь к комнате.',
            ], 403);
        }

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:2000'],
            'kind' => ['nullable', 'string', 'in:chat,note'],
        ]);

        $message = WatchRoomMessage::query()->create([
            'watch_room_id' => $room->id,
            'user_id' => $user->id,
            'body' => trim($validated['body']),
            'kind' => $validated['kind'] ?? 'chat',
        ]);
        $message->load('user:id,name,email');

        WatchRoomMember::query()
            ->where('watch_room_id', $room->id)
            ->where('user_id', $user->id)
            ->update(['last_seen_at' => now()]);

        return response()->json([
            'data' => $this->formatMessage($message),
        ], 201);
    }

    private function findRoomByCode(string $code): ?WatchRoom
    {
        return WatchRoom::query()
            ->where('code', Str::upper(trim($code)))
            ->first();
    }

    private function generateUniqueCode(): string
    {
        do {
            $code = Str::upper(Str::random(6));
        } while (WatchRoom::query()->where('code', $code)->exists());

        return $code;
    }

    private function userInRoom(WatchRoom $room, int $userId): bool
    {
        if ((int) $room->host_user_id === $userId) {
            return true;
        }

        return WatchRoomMember::query()
            ->where('watch_room_id', $room->id)
            ->where('user_id', $userId)
            ->exists();
    }

    private function formatRoomSummary(WatchRoom $room, User $viewer): array
    {
        return [
            'code' => $room->code,
            'mediaType' => $room->media_type ?: 'movie',
            'movieTitle' => $room->movie_title,
            'posterPath' => $room->poster_path,
            'posterUrl' => $this->tmdbService->imageUrl($room->poster_path),
            'releaseYear' => $room->release_year,
            'memberCount' => max(1, $room->members->count()),
            'host' => $this->formatPerson($room->host),
            'isHost' => (int) $room->host_user_id === (int) $viewer->id,
            'playback' => $this->formatPlayback($room),
            'updatedAt' => $room->updated_at?->toISOString(),
        ];
    }

    private function formatRoom(WatchRoom $room, User $viewer): array
    {
        return [
            ...$this->formatRoomSummary($room, $viewer),
            'tmdbId' => $room->tmdb_id,
            'videoUrl' => $room->video_url,
            'members' => $room->members
                ->sortBy(fn (WatchRoomMember $member) => $member->user_id === $room->host_user_id ? 0 : 1)
                ->map(fn (WatchRoomMember $member) => [
                    ...$this->formatPerson($member->user),
                    'lastSeenAt' => $member->last_seen_at?->toISOString(),
                ])
                ->values(),
            'messages' => $room->messages
                ->sortBy('created_at')
                ->take(-100)
                ->values()
                ->map(fn (WatchRoomMessage $message) => $this->formatMessage($message))
                ->values(),
        ];
    }

    private function formatPlayback(WatchRoom $room): array
    {
        return [
            'state' => $room->playback_state,
            'positionMs' => (int) $room->playback_position_ms,
            'rate' => (float) $room->playback_rate,
            'lastSyncedAt' => $room->last_synced_at?->toISOString(),
            'lastSyncedByUserId' => $room->last_synced_by_user_id,
        ];
    }

    private function formatMessage(WatchRoomMessage $message): array
    {
        return [
            'id' => $message->id,
            'kind' => $message->kind,
            'body' => $message->body,
            'createdAt' => $message->created_at?->toISOString(),
            'user' => $this->formatPerson($message->user),
        ];
    }

    private function formatPerson(?User $user): ?array
    {
        if (! $user) {
            return null;
        }

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
        ];
    }
}
