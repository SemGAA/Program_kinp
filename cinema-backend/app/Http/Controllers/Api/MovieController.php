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

        return response()->json([
            'data' => $this->tmdbService->searchMovies($validated['q']),
        ]);
    }

    public function show(int $tmdbId): JsonResponse
    {
        return response()->json([
            'data' => $this->tmdbService->getMovie($tmdbId),
        ]);
    }

    public function recommendations(Request $request, int $tmdbId): JsonResponse
    {
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
