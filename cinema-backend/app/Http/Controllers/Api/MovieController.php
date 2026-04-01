<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RecommendationService;
use App\Services\TmdbService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MovieController extends Controller
{
    public function __construct(
        private readonly TmdbService $tmdbService,
        private readonly RecommendationService $recommendationService,
    ) {
    }

    public function search(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['required', 'string', 'min:2', 'max:100'],
        ]);

        if (! $this->tmdbService->configured()) {
            return response()->json([
                'message' => 'TMDB API key is not configured.',
            ], 503);
        }

        return response()->json([
            'data' => $this->tmdbService->searchMovies($validated['q']),
        ]);
    }

    public function show(int $tmdbId): JsonResponse
    {
        if (! $this->tmdbService->configured()) {
            return response()->json([
                'message' => 'TMDB API key is not configured.',
            ], 503);
        }

        return response()->json([
            'data' => $this->tmdbService->getMovie($tmdbId),
        ]);
    }

    public function recommendations(Request $request, int $tmdbId): JsonResponse
    {
        if (! $this->tmdbService->configured()) {
            return response()->json([
                'message' => 'TMDB API key is not configured.',
            ], 503);
        }

        $validated = $request->validate([
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        return response()->json([
            'data' => $this->recommendationService->getForMovie($tmdbId, $validated['note'] ?? null),
            'meta' => [
                'aiEnabled' => filled($validated['note'] ?? null),
            ],
        ]);
    }
}
