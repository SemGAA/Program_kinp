<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Friendship;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FriendshipController extends Controller
{
    public function friends(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $friendships = Friendship::query()
            ->with(['userOne:id,name,email', 'userTwo:id,name,email'])
            ->where('status', 'accepted')
            ->where(fn ($query) => $query
                ->where('user_one_id', $user->id)
                ->orWhere('user_two_id', $user->id))
            ->latest()
            ->get();

        return response()->json([
            'data' => $friendships->map(fn (Friendship $friendship) => $this->formatFriend($friendship, $user))->values(),
        ]);
    }

    public function requests(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $friendships = Friendship::query()
            ->with(['requester:id,name,email', 'userOne:id,name,email', 'userTwo:id,name,email'])
            ->where('status', 'pending')
            ->where(fn ($query) => $query
                ->where('user_one_id', $user->id)
                ->orWhere('user_two_id', $user->id))
            ->latest()
            ->get();

        $incoming = $friendships
            ->filter(fn (Friendship $friendship) => ! $friendship->isRequestedBy($user))
            ->map(fn (Friendship $friendship) => $this->formatRequest($friendship, $user))
            ->values();

        $outgoing = $friendships
            ->filter(fn (Friendship $friendship) => $friendship->isRequestedBy($user))
            ->map(fn (Friendship $friendship) => $this->formatRequest($friendship, $user))
            ->values();

        return response()->json([
            'incoming' => $incoming,
            'outgoing' => $outgoing,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'email' => ['required', 'email', 'exists:users,email'],
        ]);

        $recipient = User::query()->where('email', $validated['email'])->firstOrFail();

        if ($recipient->is($user)) {
            return response()->json([
                'message' => 'You cannot send a request to yourself.',
            ], 422);
        }

        [$userOneId, $userTwoId] = Friendship::pairFor($user->id, $recipient->id);

        $friendship = Friendship::query()
            ->where('user_one_id', $userOneId)
            ->where('user_two_id', $userTwoId)
            ->first();

        if ($friendship?->status === 'accepted') {
            return response()->json([
                'message' => 'Users are already friends.',
            ], 422);
        }

        if ($friendship?->status === 'pending') {
            return response()->json([
                'message' => $friendship->requested_by_id === $user->id
                    ? 'Request already sent.'
                    : 'There is already an incoming request from this user.',
            ], 422);
        }

        $friendship ??= new Friendship([
            'user_one_id' => $userOneId,
            'user_two_id' => $userTwoId,
        ]);

        $friendship->fill([
            'requested_by_id' => $user->id,
            'status' => 'pending',
            'responded_at' => null,
        ]);
        $friendship->save();
        $friendship->load(['requester:id,name,email', 'userOne:id,name,email', 'userTwo:id,name,email']);

        return response()->json([
            'data' => $this->formatRequest($friendship, $user),
        ], 201);
    }

    public function accept(Request $request, Friendship $friendship): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if (! $this->canRespond($friendship, $user)) {
            return response()->json([
                'message' => 'This request cannot be accepted.',
            ], 403);
        }

        $friendship->update([
            'status' => 'accepted',
            'responded_at' => now(),
        ]);
        $friendship->load(['userOne:id,name,email', 'userTwo:id,name,email']);

        return response()->json([
            'data' => $this->formatFriend($friendship, $user),
        ]);
    }

    public function reject(Request $request, Friendship $friendship): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if (! $this->canRespond($friendship, $user)) {
            return response()->json([
                'message' => 'This request cannot be rejected.',
            ], 403);
        }

        $friendship->update([
            'status' => 'rejected',
            'responded_at' => now(),
        ]);

        return response()->json([
            'message' => 'Request rejected.',
        ]);
    }

    private function canRespond(Friendship $friendship, User $user): bool
    {
        return $friendship->status === 'pending'
            && ($friendship->user_one_id === $user->id || $friendship->user_two_id === $user->id)
            && ! $friendship->isRequestedBy($user);
    }

    private function formatFriend(Friendship $friendship, User $user): array
    {
        $friend = $friendship->otherUser($user);

        return [
            'id' => $friend->id,
            'name' => $friend->name,
            'email' => $friend->email,
            'friendshipId' => $friendship->id,
        ];
    }

    private function formatRequest(Friendship $friendship, User $user): array
    {
        $otherUser = $friendship->otherUser($user);

        return [
            'id' => $friendship->id,
            'direction' => $friendship->isRequestedBy($user) ? 'outgoing' : 'incoming',
            'status' => $friendship->status,
            'user' => [
                'id' => $otherUser->id,
                'name' => $otherUser->name,
                'email' => $otherUser->email,
            ],
            'createdAt' => $friendship->created_at?->toISOString(),
        ];
    }
}
