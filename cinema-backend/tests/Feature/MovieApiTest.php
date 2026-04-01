<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MovieApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_movie_search_is_proxied_and_normalized(): void
    {
        Sanctum::actingAs(User::factory()->create());
        config(['services.tmdb.key' => 'tmdb_test']);

        Http::fake([
            'https://api.themoviedb.org/3/search/movie*' => Http::response([
                'results' => [
                    [
                        'id' => 10,
                        'title' => 'Interstellar',
                        'overview' => 'Space travel.',
                        'poster_path' => '/poster.jpg',
                        'release_date' => '2014-11-07',
                        'vote_average' => 8.7,
                    ],
                ],
            ]),
        ]);

        $this->getJson('/api/movies/search?q=inter')
            ->assertOk()
            ->assertJsonPath('data.0.id', 10)
            ->assertJsonPath('data.0.title', 'Interstellar')
            ->assertJsonPath('data.0.posterUrl', 'https://image.tmdb.org/t/p/w500/poster.jpg')
            ->assertJsonPath('data.0.releaseYear', 2014);
    }

    public function test_recommendations_are_reranked_with_hugging_face_embeddings(): void
    {
        Sanctum::actingAs(User::factory()->create());
        config([
            'services.tmdb.key' => 'tmdb_test',
            'services.huggingface.token' => 'hf_test',
        ]);

        Http::fake([
            'https://api.themoviedb.org/3/movie/42/recommendations*' => Http::response([
                'results' => [
                    ['id' => 1, 'title' => 'Movie A', 'overview' => 'romance', 'poster_path' => null, 'release_date' => '2020-01-01'],
                    ['id' => 2, 'title' => 'Movie B', 'overview' => 'space science', 'poster_path' => null, 'release_date' => '2021-01-01'],
                ],
            ]),
            'https://router.huggingface.co/hf-inference/models/*' => Http::response([
                [1.0, 0.0],
                [0.1, 0.9],
                [0.9, 0.1],
            ]),
        ]);

        $this->getJson('/api/movies/42/recommendations?note=space science fiction')
            ->assertOk()
            ->assertJsonPath('data.0.id', 2)
            ->assertJsonPath('data.1.id', 1);
    }

    public function test_recommendations_fall_back_to_tmdb_order_when_hf_is_unavailable(): void
    {
        Sanctum::actingAs(User::factory()->create());
        config(['services.tmdb.key' => 'tmdb_test']);

        Http::fake([
            'https://api.themoviedb.org/3/movie/42/recommendations*' => Http::response([
                'results' => [
                    ['id' => 1, 'title' => 'Movie A', 'overview' => 'romance', 'poster_path' => null, 'release_date' => '2020-01-01'],
                    ['id' => 2, 'title' => 'Movie B', 'overview' => 'space science', 'poster_path' => null, 'release_date' => '2021-01-01'],
                ],
            ]),
        ]);

        $this->getJson('/api/movies/42/recommendations?note=space science fiction')
            ->assertOk()
            ->assertJsonPath('data.0.id', 1)
            ->assertJsonPath('data.1.id', 2);
    }
}
