<?php

namespace Tests\Feature;

use App\Models\Friendship;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FriendshipApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_send_and_accept_friend_request(): void
    {
        $sender = User::factory()->create(['email' => 'sender@example.com']);
        $recipient = User::factory()->create(['email' => 'recipient@example.com']);

        Sanctum::actingAs($sender);
        $this->postJson('/api/friend-requests', [
            'email' => 'recipient@example.com',
        ])->assertCreated()->assertJsonPath('data.direction', 'outgoing');

        Sanctum::actingAs($recipient);
        $requestsResponse = $this->getJson('/api/friend-requests')->assertOk();
        $friendshipId = $requestsResponse->json('incoming.0.id');

        $this->postJson("/api/friend-requests/{$friendshipId}/accept")
            ->assertOk()
            ->assertJsonPath('data.email', 'sender@example.com');

        $this->getJson('/api/friends')
            ->assertOk()
            ->assertJsonPath('data.0.email', 'sender@example.com');
    }

    public function test_user_can_reject_friend_request(): void
    {
        $sender = User::factory()->create(['email' => 'sender@example.com']);
        $recipient = User::factory()->create(['email' => 'recipient@example.com']);
        [$userOneId, $userTwoId] = Friendship::pairFor($sender->id, $recipient->id);

        $friendship = Friendship::query()->create([
            'user_one_id' => $userOneId,
            'user_two_id' => $userTwoId,
            'requested_by_id' => $sender->id,
            'status' => 'pending',
        ]);

        Sanctum::actingAs($recipient);
        $this->postJson("/api/friend-requests/{$friendship->id}/reject")
            ->assertOk()
            ->assertJsonPath('message', 'Request rejected.');

        $this->assertDatabaseHas('friendships', [
            'id' => $friendship->id,
            'status' => 'rejected',
        ]);
    }
}
