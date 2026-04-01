<?php

namespace App\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;

class TmdbService
{
    private const SUPPORTED_MEDIA_TYPES = ['movie', 'tv'];

    public function configured(): bool
    {
        return filled(config('services.tmdb.key')) || filled(config('services.tmdb.read_access_token'));
    }

    public function searchMovies(string $query): array
    {
        if (! $this->configured()) {
            return $this->fallbackSearchMovies($query);
        }

        $payload = $this->get('search/multi', [
            'query' => $query,
            'language' => 'ru-RU',
            'include_adult' => 'false',
        ]);

        return collect($payload['results'] ?? [])
            ->filter(fn (array $item) => in_array($item['media_type'] ?? 'movie', self::SUPPORTED_MEDIA_TYPES, true))
            ->map(fn (array $item) => $this->formatSummary($item))
            ->values()
            ->all();
    }

    public function getMovie(int $tmdbId, string $mediaType = 'movie'): array
    {
        $normalizedMediaType = $this->normalizeMediaType($mediaType);

        if (! $this->configured()) {
            return $this->fallbackGetMovie($tmdbId, $normalizedMediaType);
        }

        return $this->formatDetails($this->get("{$normalizedMediaType}/{$tmdbId}", [
            'language' => 'ru-RU',
        ]), $normalizedMediaType);
    }

    public function getRecommendations(int $tmdbId, string $mediaType = 'movie'): array
    {
        $normalizedMediaType = $this->normalizeMediaType($mediaType);

        if (! $this->configured()) {
            return $this->fallbackRecommendations($tmdbId, $normalizedMediaType);
        }

        $payload = $this->get("{$normalizedMediaType}/{$tmdbId}/recommendations", [
            'language' => 'ru-RU',
        ]);

        return array_map(
            fn (array $item) => $this->formatSummary([
                ...$item,
                'media_type' => $normalizedMediaType,
            ]),
            $payload['results'] ?? []
        );
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
        $client = Http::acceptJson()
            ->baseUrl((string) config('services.tmdb.base_url'))
            ->timeout(15);

        $token = config('services.tmdb.read_access_token');

        if (filled($token)) {
            $client = $client->withToken((string) $token);
        }

        return $client;
    }

    private function get(string $uri, array $query = []): array
    {
        $response = $this->client()->get($uri, array_filter([
            'api_key' => filled(config('services.tmdb.read_access_token')) ? null : config('services.tmdb.key'),
            ...$query,
        ], static fn ($value) => filled($value)));

        return $response->throw()->json() ?? [];
    }

    private function formatSummary(array $movie): array
    {
        $mediaType = $this->normalizeMediaType($movie['media_type'] ?? null);
        $title = (string) ($movie['title'] ?? $movie['name'] ?? 'Untitled');
        $releaseDate = $mediaType === 'tv'
            ? ($movie['first_air_date'] ?? null)
            : ($movie['release_date'] ?? null);

        return [
            'id' => (int) $movie['id'],
            'mediaType' => $mediaType,
            'mediaLabel' => $this->mediaLabel($mediaType),
            'title' => $title,
            'overview' => (string) ($movie['overview'] ?? ''),
            'posterPath' => $movie['poster_path'] ?? null,
            'posterUrl' => $this->imageUrl($movie['poster_path'] ?? null),
            'releaseYear' => $this->extractYear($releaseDate),
            'rating' => isset($movie['vote_average']) ? (float) $movie['vote_average'] : null,
        ];
    }

    private function formatDetails(array $movie, string $mediaType = 'movie'): array
    {
        return [
            ...$this->formatSummary([
                ...$movie,
                'media_type' => $this->normalizeMediaType($movie['media_type'] ?? $mediaType),
            ]),
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

    private function fallbackGetMovie(int $tmdbId, string $mediaType = 'movie'): array
    {
        $movie = collect($this->fallbackCatalog())->first(
            fn (array $item) => (int) $item['id'] === $tmdbId && $this->normalizeMediaType($item['media_type'] ?? null) === $mediaType
        );

        abort_unless(is_array($movie), 404, 'Фильм не найден.');

        return $this->formatFallbackDetails($movie);
    }

    private function fallbackRecommendations(int $tmdbId, string $mediaType = 'movie'): array
    {
        $catalog = $this->fallbackCatalog();
        $movie = collect($catalog)->first(
            fn (array $item) => (int) $item['id'] === $tmdbId && $this->normalizeMediaType($item['media_type'] ?? null) === $mediaType
        );

        if (! is_array($movie)) {
            return [];
        }

        return collect($catalog)
            ->filter(fn (array $candidate) => $candidate['id'] !== $tmdbId)
            ->map(function (array $candidate) use ($movie): array {
                $sharedGenres = count(array_intersect($movie['genres'] ?? [], $candidate['genres'] ?? []));
                $sharedAliases = count(array_intersect($movie['aliases'] ?? [], $candidate['aliases'] ?? []));
                $sameMediaType = $this->normalizeMediaType($candidate['media_type'] ?? null) === $this->normalizeMediaType($movie['media_type'] ?? null);

                return [
                    ...$candidate,
                    '_score' => ($sameMediaType ? 20 : 0) + ($sharedGenres * 10) + ($sharedAliases * 3),
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
        $mediaType = $this->normalizeMediaType($movie['media_type'] ?? null);

        return [
            'id' => (int) $movie['id'],
            'mediaType' => $mediaType,
            'mediaLabel' => $this->mediaLabel($mediaType),
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

    private function normalizeMediaType(?string $mediaType): string
    {
        return in_array($mediaType, self::SUPPORTED_MEDIA_TYPES, true) ? $mediaType : 'movie';
    }

    private function mediaLabel(string $mediaType): string
    {
        return $mediaType === 'tv' ? 'Сериал' : 'Фильм';
    }
}
