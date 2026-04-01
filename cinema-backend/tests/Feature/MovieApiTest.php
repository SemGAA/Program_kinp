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
            'https://api.themoviedb.org/3/search/multi*' => Http::response([
                'results' => [
                    [
                        'id' => 10,
                        'media_type' => 'movie',
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
            ->assertJsonPath('data.0.mediaType', 'movie')
            ->assertJsonPath('data.0.title', 'Interstellar')
            ->assertJsonPath('data.0.posterUrl', 'https://image.tmdb.org/t/p/w500/poster.jpg')
            ->assertJsonPath('data.0.releaseYear', 2014);
    }

    public function test_movie_search_falls_back_to_local_catalog_without_tmdb_key(): void
    {
        Sanctum::actingAs(User::factory()->create());
        config(['services.tmdb.key' => null]);

        $this->getJson('/api/movies/search?q=по')
            ->assertOk()
            ->assertJsonFragment(['title' => 'Побег из Шоушенка']);
    }

    public function test_tv_search_falls_back_to_local_catalog_without_tmdb_key(): void
    {
        Sanctum::actingAs(User::factory()->create());
        config(['services.tmdb.key' => null]);

        $this->getJson('/api/movies/search?q=дорама')
            ->assertOk()
            ->assertJsonFragment([
                'title' => 'Истинная красота',
                'mediaType' => 'tv',
            ]);
    }

    public function test_movie_details_fall_back_to_local_catalog_without_tmdb_key(): void
    {
        Sanctum::actingAs(User::factory()->create());
        config(['services.tmdb.key' => null]);

        $this->getJson('/api/movies/9001?mediaType=movie')
            ->assertOk()
            ->assertJsonPath('data.title', 'Интерстеллар')
            ->assertJsonPath('data.runtime', 169)
            ->assertJsonPath('data.genres.0', 'научная фантастика');
    }

    public function test_tv_details_fall_back_to_local_catalog_without_tmdb_key(): void
    {
        Sanctum::actingAs(User::factory()->create());
        config(['services.tmdb.key' => null]);

        $this->getJson('/api/movies/9103?mediaType=tv')
            ->assertOk()
            ->assertJsonPath('data.title', 'Атака титанов')
            ->assertJsonPath('data.mediaType', 'tv')
            ->assertJsonPath('data.runtime', 24);
    }

    public function test_movie_recommendations_fall_back_to_local_catalog_without_tmdb_key(): void
    {
        Sanctum::actingAs(User::factory()->create());
        config(['services.tmdb.key' => null]);

        $this->getJson('/api/movies/9001/recommendations?mediaType=movie&note=космос')
            ->assertOk()
            ->assertJsonCount(8, 'data')
            ->assertJsonPath('data.0.title', 'Дюна');
    }

    public function test_tv_recommendations_fall_back_to_local_catalog_without_tmdb_key(): void
    {
        Sanctum::actingAs(User::factory()->create());
        config(['services.tmdb.key' => null]);

        $this->getJson('/api/movies/9103/recommendations?mediaType=tv&note=аниме')
            ->assertOk()
            ->assertJsonCount(8, 'data')
            ->assertJsonPath('data.0.mediaType', 'tv');
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
