<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WatchRoomApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_host_can_create_room_sync_playback_and_send_note(): void
    {
        $host = User::factory()->create();
        Sanctum::actingAs($host);

        $createResponse = $this->postJson('/api/watch-rooms', [
            'tmdb_id' => 42,
            'movie_title' => 'Interstellar',
            'poster_path' => '/poster.jpg',
            'release_year' => 2014,
            'video_url' => 'https://example.com/interstellar.mp4',
        ]);

        $code = $createResponse->json('data.code');

        $createResponse->assertCreated()
            ->assertJsonPath('data.movieTitle', 'Interstellar')
            ->assertJsonPath('data.isHost', true)
            ->assertJsonPath('data.memberCount', 1)
            ->assertJsonPath('data.videoUrl', 'https://example.com/interstellar.mp4');

        $this->postJson("/api/watch-rooms/{$code}/sync", [
            'playback_state' => 'playing',
            'playback_position_ms' => 15000,
            'playback_rate' => 1,
        ])->assertOk()
            ->assertJsonPath('data.state', 'playing')
            ->assertJsonPath('data.positionMs', 15000);

        $this->postJson("/api/watch-rooms/{$code}/messages", [
            'kind' => 'note',
            'body' => 'Зафиксировать сцену на 00:15.',
        ])->assertCreated()
            ->assertJsonPath('data.kind', 'note')
            ->assertJsonPath('data.body', 'Зафиксировать сцену на 00:15.');
    }

    public function test_second_user_can_join_room_but_cannot_control_playback(): void
    {
        $host = User::factory()->create();
        $guest = User::factory()->create();

        Sanctum::actingAs($host);
        $code = $this->postJson('/api/watch-rooms', [
            'movie_title' => 'Dune',
            'video_url' => 'https://example.com/dune.m3u8',
        ])->json('data.code');

        Sanctum::actingAs($guest);

        $this->postJson('/api/watch-rooms/join', [
            'code' => $code,
        ])->assertOk()
            ->assertJsonPath('data.code', $code)
            ->assertJsonPath('data.memberCount', 2)
            ->assertJsonPath('data.isHost', false);

        $this->postJson("/api/watch-rooms/{$code}/sync", [
            'playback_state' => 'playing',
            'playback_position_ms' => 9000,
        ])->assertForbidden();

        $this->postJson("/api/watch-rooms/{$code}/messages", [
            'kind' => 'chat',
            'body' => 'Пошли смотреть.',
        ])->assertCreated()
            ->assertJsonPath('data.user.id', $guest->id);

        $this->getJson("/api/watch-rooms/{$code}")
            ->assertOk()
            ->assertJsonPath('data.memberCount', 2)
            ->assertJsonCount(2, 'data.members');
    }
}
