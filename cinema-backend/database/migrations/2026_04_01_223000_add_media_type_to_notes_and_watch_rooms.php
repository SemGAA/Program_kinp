<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('movie_notes', function (Blueprint $table): void {
            $table->string('media_type', 20)->default('movie')->after('tmdb_id');
            $table->index(['media_type', 'tmdb_id']);
        });

        Schema::table('watch_rooms', function (Blueprint $table): void {
            $table->string('media_type', 20)->default('movie')->after('tmdb_id');
            $table->index(['media_type', 'tmdb_id']);
        });

        DB::table('movie_notes')->whereNull('media_type')->update([
            'media_type' => 'movie',
        ]);

        DB::table('watch_rooms')->whereNull('media_type')->update([
            'media_type' => 'movie',
        ]);
    }

    public function down(): void
    {
        Schema::table('movie_notes', function (Blueprint $table): void {
            $table->dropIndex(['media_type', 'tmdb_id']);
            $table->dropColumn('media_type');
        });

        Schema::table('watch_rooms', function (Blueprint $table): void {
            $table->dropIndex(['media_type', 'tmdb_id']);
            $table->dropColumn('media_type');
        });
    }
};
