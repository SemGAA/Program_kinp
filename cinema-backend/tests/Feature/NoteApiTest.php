<?php

namespace Tests\Feature;

use App\Models\Friendship;
use App\Models\MovieNote;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class NoteApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_create_share_and_accept_note(): void
    {
        $owner = User::factory()->create();
        $friend = User::factory()->create();
        [$userOneId, $userTwoId] = Friendship::pairFor($owner->id, $friend->id);

        Friendship::query()->create([
            'user_one_id' => $userOneId,
            'user_two_id' => $userTwoId,
            'requested_by_id' => $owner->id,
            'status' => 'accepted',
            'responded_at' => now(),
        ]);

        Sanctum::actingAs($owner);

        $createResponse = $this->postJson('/api/notes', [
            'tmdb_id' => 42,
            'media_type' => 'tv',
            'movie_title' => 'Interstellar',
            'poster_path' => '/poster.jpg',
            'release_year' => 2014,
            'note_text' => 'Watch together on Saturday.',
        ]);

        $noteId = $createResponse->json('data.id');

        $this->patchJson("/api/notes/{$noteId}", [
            'note_text' => 'Watch together on Saturday evening.',
        ])->assertOk()->assertJsonPath('data.noteText', 'Watch together on Saturday evening.');

        $this->postJson("/api/notes/{$noteId}/share", [
            'recipient_id' => $friend->id,
        ])->assertOk()->assertJsonPath('data.status', 'sent');

        Sanctum::actingAs($friend);

        $this->postJson("/api/notes/{$noteId}/accept")
            ->assertOk()
            ->assertJsonPath('data.status', 'accepted')
            ->assertJsonPath('data.mediaType', 'tv')
            ->assertJsonPath('data.recipient.id', $friend->id);
    }

    public function test_user_can_reject_incoming_note_and_others_cannot_manage_it(): void
    {
        $owner = User::factory()->create();
        $friend = User::factory()->create();
        $outsider = User::factory()->create();

        $note = MovieNote::query()->create([
            'user_id' => $owner->id,
            'tmdb_id' => 7,
            'media_type' => 'movie',
            'movie_title' => 'Dune',
            'note_text' => 'Discuss after watching.',
            'movie_id' => 7,
            'title' => 'Dune',
            'description' => 'Discuss after watching.',
            'status' => 'sent',
            'sent_to' => $friend->id,
            'sent_at' => now(),
        ]);

        Sanctum::actingAs($outsider);
        $this->postJson("/api/notes/{$note->id}/accept")->assertForbidden();
        $this->patchJson("/api/notes/{$note->id}", [
            'note_text' => 'Outsider edit',
        ])->assertForbidden();

        Sanctum::actingAs($friend);
        $this->postJson("/api/notes/{$note->id}/reject")
            ->assertOk()
            ->assertJsonPath('data.status', 'rejected');
    }
}
