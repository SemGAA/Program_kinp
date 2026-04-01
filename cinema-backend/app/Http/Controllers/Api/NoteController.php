<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Friendship;
use App\Models\MovieNote;
use App\Models\User;
use App\Services\TmdbService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NoteController extends Controller
{
    public function __construct(
        private readonly TmdbService $tmdbService,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $ownNotes = MovieNote::query()
            ->with(['owner:id,name,email', 'recipient:id,name,email'])
            ->where('user_id', $user->id)
            ->latest()
            ->get();

        $incomingNotes = MovieNote::query()
            ->with(['owner:id,name,email', 'recipient:id,name,email'])
            ->where('sent_to', $user->id)
            ->latest()
            ->get();

        return response()->json([
            'own' => $ownNotes->map(fn (MovieNote $note) => $this->formatNote($note))->values(),
            'incoming' => $incomingNotes->map(fn (MovieNote $note) => $this->formatNote($note))->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'tmdb_id' => ['required', 'integer'],
            'media_type' => ['nullable', 'string', 'in:movie,tv'],
            'movie_title' => ['required', 'string', 'max:255'],
            'poster_path' => ['nullable', 'string', 'max:255'],
            'release_year' => ['nullable', 'integer', 'min:1888', 'max:2100'],
            'note_text' => ['required', 'string', 'max:2000'],
        ]);

        $note = MovieNote::query()->create([
            'user_id' => $user->id,
            'tmdb_id' => $validated['tmdb_id'],
            'media_type' => $validated['media_type'] ?? 'movie',
            'movie_title' => $validated['movie_title'],
            'poster_path' => $validated['poster_path'] ?? null,
            'release_year' => $validated['release_year'] ?? null,
            'note_text' => $validated['note_text'],
            'movie_id' => $validated['tmdb_id'],
            'title' => $validated['movie_title'],
            'description' => $validated['note_text'],
            'status' => 'pending',
        ]);
        $note->load(['owner:id,name,email', 'recipient:id,name,email']);

        return response()->json([
            'data' => $this->formatNote($note),
        ], 201);
    }

    public function update(Request $request, MovieNote $movieNote): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if ($movieNote->user_id !== $user->id) {
            return response()->json([
                'message' => 'Нельзя редактировать чужую заметку.',
            ], 403);
        }

        $validated = $request->validate([
            'note_text' => ['required', 'string', 'max:2000'],
        ]);

        $movieNote->update([
            'note_text' => $validated['note_text'],
            'description' => $validated['note_text'],
        ]);
        $movieNote->load(['owner:id,name,email', 'recipient:id,name,email']);

        return response()->json([
            'data' => $this->formatNote($movieNote),
        ]);
    }

    public function share(Request $request, MovieNote $movieNote): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if ($movieNote->user_id !== $user->id) {
            return response()->json([
                'message' => 'Нельзя отправить чужую заметку.',
            ], 403);
        }

        $validated = $request->validate([
            'recipient_id' => ['required', 'integer', 'exists:users,id'],
        ]);

        if ((int) $validated['recipient_id'] === $user->id) {
            return response()->json([
                'message' => 'Нельзя отправить заметку самому себе.',
            ], 422);
        }

        if (! $this->usersAreFriends($user->id, (int) $validated['recipient_id'])) {
            return response()->json([
                'message' => 'Заметки можно отправлять только друзьям.',
            ], 422);
        }

        $movieNote->update([
            'sent_to' => $validated['recipient_id'],
            'status' => 'sent',
            'sent_at' => now(),
            'responded_at' => null,
        ]);
        $movieNote->load(['owner:id,name,email', 'recipient:id,name,email']);

        return response()->json([
            'data' => $this->formatNote($movieNote),
        ]);
    }

    public function accept(Request $request, MovieNote $movieNote): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if ($movieNote->sent_to !== $user->id || $movieNote->status !== 'sent') {
            return response()->json([
                'message' => 'Эту заметку нельзя принять.',
            ], 403);
        }

        $movieNote->update([
            'status' => 'accepted',
            'responded_at' => now(),
        ]);
        $movieNote->load(['owner:id,name,email', 'recipient:id,name,email']);

        return response()->json([
            'data' => $this->formatNote($movieNote),
        ]);
    }

    public function reject(Request $request, MovieNote $movieNote): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if ($movieNote->sent_to !== $user->id || $movieNote->status !== 'sent') {
            return response()->json([
                'message' => 'Эту заметку нельзя отклонить.',
            ], 403);
        }

        $movieNote->update([
            'status' => 'rejected',
            'responded_at' => now(),
        ]);
        $movieNote->load(['owner:id,name,email', 'recipient:id,name,email']);

        return response()->json([
            'data' => $this->formatNote($movieNote),
        ]);
    }

    private function usersAreFriends(int $firstUserId, int $secondUserId): bool
    {
        [$userOneId, $userTwoId] = Friendship::pairFor($firstUserId, $secondUserId);

        return Friendship::query()
            ->where('user_one_id', $userOneId)
            ->where('user_two_id', $userTwoId)
            ->where('status', 'accepted')
            ->exists();
    }

    private function formatNote(MovieNote $note): array
    {
        return [
            'id' => $note->id,
            'mediaType' => $note->media_type ?: 'movie',
            'tmdbId' => $note->tmdb_id ?? $note->movie_id,
            'movieTitle' => $note->movie_title ?? $note->title,
            'posterPath' => $note->poster_path,
            'posterUrl' => $this->tmdbService->imageUrl($note->poster_path),
            'releaseYear' => $note->release_year,
            'noteText' => $note->note_text ?? $note->description,
            'status' => $note->status,
            'owner' => $note->owner ? [
                'id' => $note->owner->id,
                'name' => $note->owner->name,
                'email' => $note->owner->email,
            ] : null,
            'recipient' => $note->recipient ? [
                'id' => $note->recipient->id,
                'name' => $note->recipient->name,
                'email' => $note->recipient->email,
            ] : null,
            'sentAt' => $note->sent_at?->toISOString(),
            'respondedAt' => $note->responded_at?->toISOString(),
            'createdAt' => $note->created_at?->toISOString(),
        ];
    }
}
