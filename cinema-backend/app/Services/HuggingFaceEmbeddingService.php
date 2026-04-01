<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use RuntimeException;

class HuggingFaceEmbeddingService
{
    public function configured(): bool
    {
        return filled(config('services.huggingface.token'));
    }

    public function embedTexts(array $texts): array
    {
        $texts = array_values(array_map(
            static fn (string $text) => trim($text),
            array_filter($texts, static fn ($text) => is_string($text) && filled(trim($text)))
        ));

        if ($texts === []) {
            return [];
        }

        $response = Http::acceptJson()
            ->withToken((string) config('services.huggingface.token'))
            ->timeout(20)
            ->post($this->endpoint(), [
                'inputs' => $texts,
                'normalize' => true,
                'truncate' => true,
            ]);

        $payload = $response->throw()->json();

        if (! is_array($payload)) {
            throw new RuntimeException('Unexpected Hugging Face response.');
        }

        return array_map(
            static fn (array $embedding) => array_map('floatval', $embedding),
            $payload
        );
    }

    private function endpoint(): string
    {
        $baseUrl = rtrim((string) config('services.huggingface.base_url'), '/');
        $model = trim((string) config('services.huggingface.model'), '/');

        return "{$baseUrl}/{$model}";
    }
}
