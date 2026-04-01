<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('watch_rooms', function (Blueprint $table): void {
            $table->id();
            $table->string('code', 12)->unique();
            $table->foreignId('host_user_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedBigInteger('tmdb_id')->nullable();
            $table->string('movie_title');
            $table->string('poster_path')->nullable();
            $table->unsignedSmallInteger('release_year')->nullable();
            $table->string('video_url', 2000);
            $table->string('playback_state', 20)->default('paused');
            $table->unsignedBigInteger('playback_position_ms')->default(0);
            $table->decimal('playback_rate', 4, 2)->default(1.00);
            $table->timestamp('last_synced_at')->nullable();
            $table->foreignId('last_synced_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('watch_rooms');
    }
};
