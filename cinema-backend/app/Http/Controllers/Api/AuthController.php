<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Friendship;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
        ]);

        $user = User::create($validated);
        $token = $user->createToken('mobile')->plainTextToken;

        return response()->json([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => $this->formatUser($user),
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (! Auth::attempt($credentials)) {
            return response()->json([
                'message' => 'Неверный email или пароль.',
            ], 401);
        }

        /** @var User $user */
        $user = User::query()->where('email', $credentials['email'])->firstOrFail();
        $token = $user->createToken('mobile')->plainTextToken;

        return response()->json([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => $this->formatUser($user),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();
        $currentToken = $user?->currentAccessToken();

        if ($currentToken && method_exists($currentToken, 'delete')) {
            $currentToken->delete();
        } elseif ($user) {
            $user->tokens()->delete();
        }

        return response()->json([
            'message' => 'Signed out.',
        ]);
    }

    public function user(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json($this->formatUser($user));
    }

    private function formatUser(User $user): array
    {
        $friendsCount = Friendship::query()
            ->where('status', 'accepted')
            ->where(fn ($query) => $query
                ->where('user_one_id', $user->id)
                ->orWhere('user_two_id', $user->id))
            ->count();

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'stats' => [
                'notes' => $user->notes()->count(),
                'friends' => $friendsCount,
            ],
        ];
    }
}