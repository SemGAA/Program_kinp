<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_register_and_receive_token(): void
    {
        $response = $this->postJson('/api/register', [
            'name' => 'Ivan',
            'email' => 'ivan@example.com',
            'password' => 'password123',
        ]);

        $response->assertCreated()
            ->assertJsonPath('user.name', 'Ivan')
            ->assertJsonPath('user.stats.notes', 0)
            ->assertJsonPath('user.stats.friends', 0)
            ->assertJsonStructure([
                'access_token',
                'token_type',
                'user' => ['id', 'name', 'email', 'stats' => ['notes', 'friends']],
            ]);
    }

    public function test_user_can_login_logout_and_fetch_profile(): void
    {
        $this->postJson('/api/register', [
            'name' => 'Maria',
            'email' => 'maria@example.com',
            'password' => 'password123',
        ]);

        $loginResponse = $this->postJson('/api/login', [
            'email' => 'maria@example.com',
            'password' => 'password123',
        ]);

        $token = $loginResponse->json('access_token');

        $this->withToken($token)
            ->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('email', 'maria@example.com');

        $this->withToken($token)
            ->postJson('/api/logout')
            ->assertOk()
            ->assertJsonPath('message', 'Signed out.');
    }
}
