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
        if (! $this->configured()) {
            return $this->fallbackSearchMovies($query);
        }

        $payload = $this->get('search/movie', [
            'query' => $query,
            'language' => 'ru-RU',
            'include_adult' => 'false',
        ]);

        return array_map(fn (array $movie) => $this->formatSummary($movie), $payload['results'] ?? []);
    }

    public function getMovie(int $tmdbId): array
    {
        if (! $this->configured()) {
            return $this->fallbackGetMovie($tmdbId);
        }

        return $this->formatDetails($this->get("movie/{$tmdbId}", [
            'language' => 'ru-RU',
        ]));
    }

    public function getRecommendations(int $tmdbId): array
    {
        if (! $this->configured()) {
            return $this->fallbackRecommendations($tmdbId);
        }

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

    private function fallbackSearchMovies(string $query): array
    {
        $needle = mb_strtolower(trim($query));

        if ($needle === '') {
            return [];
        }

        $movies = collect($this->fallbackCatalog())
            ->map(function (array $movie) use ($needle): array {
                $score = $this->fallbackSearchScore($movie, $needle);

                return [
                    ...$movie,
                    '_score' => $score,
                ];
            })
            ->filter(static fn (array $movie) => $movie['_score'] > 0)
            ->sortByDesc('_score')
            ->take(20)
            ->map(function (array $movie): array {
                unset($movie['_score']);

                return $this->formatFallbackSummary($movie);
            })
            ->values()
            ->all();

        return $movies;
    }

    private function fallbackGetMovie(int $tmdbId): array
    {
        $movie = collect($this->fallbackCatalog())->firstWhere('id', $tmdbId);

        abort_unless(is_array($movie), 404, 'Фильм не найден.');

        return $this->formatFallbackDetails($movie);
    }

    private function fallbackRecommendations(int $tmdbId): array
    {
        $catalog = $this->fallbackCatalog();
        $movie = collect($catalog)->firstWhere('id', $tmdbId);

        if (! is_array($movie)) {
            return [];
        }

        return collect($catalog)
            ->filter(static fn (array $candidate) => $candidate['id'] !== $tmdbId)
            ->map(function (array $candidate) use ($movie): array {
                $sharedGenres = count(array_intersect($movie['genres'] ?? [], $candidate['genres'] ?? []));
                $sharedAliases = count(array_intersect($movie['aliases'] ?? [], $candidate['aliases'] ?? []));

                return [
                    ...$candidate,
                    '_score' => ($sharedGenres * 10) + ($sharedAliases * 3),
                ];
            })
            ->sortByDesc('_score')
            ->take(8)
            ->map(function (array $candidate): array {
                unset($candidate['_score']);

                return $this->formatFallbackSummary($candidate);
            })
            ->values()
            ->all();
    }

    private function fallbackCatalog(): array
    {
        return config('movie_catalog', []);
    }

    private function fallbackSearchScore(array $movie, string $needle): int
    {
        $score = 0;
        $title = mb_strtolower((string) ($movie['title'] ?? ''));
        $originalTitle = mb_strtolower((string) ($movie['original_title'] ?? ''));
        $overview = mb_strtolower((string) ($movie['overview'] ?? ''));

        if ($title !== '' && str_contains($title, $needle)) {
            $score += str_starts_with($title, $needle) ? 100 : 70;
        }

        if ($originalTitle !== '' && str_contains($originalTitle, $needle)) {
            $score += str_starts_with($originalTitle, $needle) ? 60 : 40;
        }

        foreach (($movie['aliases'] ?? []) as $alias) {
            $normalizedAlias = mb_strtolower((string) $alias);

            if ($normalizedAlias !== '' && str_contains($normalizedAlias, $needle)) {
                $score += str_starts_with($normalizedAlias, $needle) ? 45 : 25;
            }
        }

        foreach (($movie['genres'] ?? []) as $genre) {
            $normalizedGenre = mb_strtolower((string) $genre);

            if ($normalizedGenre !== '' && str_contains($normalizedGenre, $needle)) {
                $score += 12;
            }
        }

        if ($overview !== '' && str_contains($overview, $needle)) {
            $score += 8;
        }

        return $score;
    }

    private function formatFallbackSummary(array $movie): array
    {
        return [
            'id' => (int) $movie['id'],
            'title' => (string) $movie['title'],
            'overview' => (string) $movie['overview'],
            'posterPath' => null,
            'posterUrl' => null,
            'releaseYear' => (int) $movie['release_year'],
            'rating' => (float) $movie['rating'],
        ];
    }

    private function formatFallbackDetails(array $movie): array
    {
        return [
            ...$this->formatFallbackSummary($movie),
            'backdropPath' => null,
            'backdropUrl' => null,
            'genres' => array_values($movie['genres'] ?? []),
            'runtime' => (int) $movie['runtime'],
        ];
    }
}
