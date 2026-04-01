<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('watch_room_members', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('watch_room_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamps();
            $table->unique(['watch_room_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('watch_room_members');
    }
};
