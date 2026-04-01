<?php

namespace App\Services;

use Throwable;

class RecommendationService
{
    public function __construct(
        private readonly TmdbService $tmdbService,
        private readonly HuggingFaceEmbeddingService $embeddingService,
    ) {
    }

    public function getForMovie(int $tmdbId, ?string $note = null, string $mediaType = 'movie'): array
    {
        $recommendations = $this->tmdbService->getRecommendations($tmdbId, $mediaType);

        if (blank($note) || count($recommendations) < 2 || ! $this->embeddingService->configured()) {
            return $recommendations;
        }

        try {
            $candidateTexts = array_map(
                static fn (array $movie) => trim(($movie['title'] ?? '') . ' ' . ($movie['overview'] ?? '')),
                $recommendations
            );

            $embeddings = $this->embeddingService->embedTexts([(string) $note, ...$candidateTexts]);

            if (count($embeddings) !== count($recommendations) + 1) {
                return $recommendations;
            }

            $queryVector = array_shift($embeddings);

            $scored = array_map(
                fn (array $movie, int $index) => [
                    ...$movie,
                    '_score' => $this->cosineSimilarity($queryVector, $embeddings[$index] ?? []),
                    '_index' => $index,
                ],
                $recommendations,
                array_keys($recommendations),
            );

            usort($scored, static function (array $left, array $right): int {
                $scoreComparison = ($right['_score'] <=> $left['_score']);

                return $scoreComparison !== 0 ? $scoreComparison : ($left['_index'] <=> $right['_index']);
            });

            return array_map(static function (array $movie): array {
                unset($movie['_score'], $movie['_index']);

                return $movie;
            }, $scored);
        } catch (Throwable $exception) {
            report($exception);

            return $recommendations;
        }
    }

    private function cosineSimilarity(array $left, array $right): float
    {
        if ($left === [] || $right === [] || count($left) !== count($right)) {
            return 0.0;
        }

        $dotProduct = 0.0;
        $leftNorm = 0.0;
        $rightNorm = 0.0;

        foreach ($left as $index => $value) {
            $rightValue = $right[$index];
            $dotProduct += $value * $rightValue;
            $leftNorm += $value ** 2;
            $rightNorm += $rightValue ** 2;
        }

        if ($leftNorm === 0.0 || $rightNorm === 0.0) {
            return 0.0;
        }

        return $dotProduct / (sqrt($leftNorm) * sqrt($rightNorm));
    }
}
