<?php

namespace App\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;

class TmdbService
{
    public function configured(): bool
    {
        return filled(config('services.tmdb.key'));
    }

    public function searchMovies(string $query): array
    {
        $payload = $this->get('search/movie', [
            'query' => $query,
            'language' => 'ru-RU',
            'include_adult' => 'false',
        ]);

        return array_map(fn (array $movie) => $this->formatSummary($movie), $payload['results'] ?? []);
    }

    public function getMovie(int $tmdbId): array
    {
        return $this->formatDetails($this->get("movie/{$tmdbId}", [
            'language' => 'ru-RU',
        ]));
    }

    public function getRecommendations(int $tmdbId): array
    {
        $payload = $this->get("movie/{$tmdbId}/recommendations", [
            'language' => 'ru-RU',
        ]);

        return array_map(fn (array $movie) => $this->formatSummary($movie), $payload['results'] ?? []);
    }

    public function imageUrl(?string $path): ?string
    {
        if (blank($path)) {
            return null;
        }

        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            return $path;
        }

        return rtrim((string) config('services.tmdb.image_base_url'), '/') . '/' . ltrim($path, '/');
    }

    private function client(): PendingRequest
    {
        return Http::acceptJson()
            ->baseUrl((string) config('services.tmdb.base_url'))
            ->timeout(15);
    }

    private function get(string $uri, array $query = []): array
    {
        $response = $this->client()->get($uri, array_filter([
            'api_key' => config('services.tmdb.key'),
            ...$query,
        ], static fn ($value) => filled($value)));

        return $response->throw()->json() ?? [];
    }

    private function formatSummary(array $movie): array
    {
        $title = (string) ($movie['title'] ?? $movie['name'] ?? 'Untitled');

        return [
            'id' => (int) $movie['id'],
            'title' => $title,
            'overview' => (string) ($movie['overview'] ?? ''),
            'posterPath' => $movie['poster_path'] ?? null,
            'posterUrl' => $this->imageUrl($movie['poster_path'] ?? null),
            'releaseYear' => $this->extractYear($movie['release_date'] ?? null),
            'rating' => isset($movie['vote_average']) ? (float) $movie['vote_average'] : null,
        ];
    }

    private function formatDetails(array $movie): array
    {
        return [
            ...$this->formatSummary($movie),
            'backdropPath' => $movie['backdrop_path'] ?? null,
            'backdropUrl' => $this->imageUrl($movie['backdrop_path'] ?? null),
            'genres' => array_values(array_map(
                static fn (array $genre) => (string) ($genre['name'] ?? ''),
                $movie['genres'] ?? []
            )),
            'runtime' => isset($movie['runtime']) ? (int) $movie['runtime'] : null,
        ];
    }

    private function extractYear(?string $releaseDate): ?int
    {
        if (blank($releaseDate) || ! preg_match('/^\d{4}/', $releaseDate, $matches)) {
            return null;
        }

        return (int) $matches[0];
    }
}
