<?php

namespace Database\Seeders;

use App\Models\Friendship;
use App\Models\MovieNote;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $alice = User::query()->firstOrCreate(
            ['email' => 'alice@example.com'],
            [
                'name' => 'Alice',
                'password' => 'password123',
            ],
        );

        $bob = User::query()->firstOrCreate(
            ['email' => 'bob@example.com'],
            [
                'name' => 'Bob',
                'password' => 'password123',
            ],
        );

        [$userOneId, $userTwoId] = Friendship::pairFor($alice->id, $bob->id);

        Friendship::query()->updateOrCreate(
            [
                'user_one_id' => $userOneId,
                'user_two_id' => $userTwoId,
            ],
            [
                'requested_by_id' => $alice->id,
                'status' => 'accepted',
                'responded_at' => now(),
            ],
        );

        MovieNote::query()->updateOrCreate(
            [
                'user_id' => $alice->id,
                'tmdb_id' => 157336,
                'sent_to' => $bob->id,
            ],
            [
                'movie_id' => 157336,
                'movie_title' => 'Interstellar',
                'title' => 'Interstellar',
                'poster_path' => '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
                'release_year' => 2014,
                'note_text' => 'Epic sci-fi about time, family, and big-screen emotions.',
                'description' => 'Epic sci-fi about time, family, and big-screen emotions.',
                'status' => 'sent',
                'sent_at' => now()->subDay(),
                'responded_at' => null,
            ],
        );
    }
}
