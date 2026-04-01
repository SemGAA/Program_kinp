<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('movie_notes', function (Blueprint $table) {
            $table->unsignedBigInteger('tmdb_id')->nullable()->after('user_id');
            $table->string('movie_title')->nullable()->after('tmdb_id');
            $table->string('poster_path')->nullable()->after('movie_title');
            $table->unsignedSmallInteger('release_year')->nullable()->after('poster_path');
            $table->text('note_text')->nullable()->after('release_year');
            $table->index(['user_id', 'status']);
            $table->index(['sent_to', 'status']);
        });

        DB::table('movie_notes')->update([
            'tmdb_id' => DB::raw('movie_id'),
            'movie_title' => DB::raw('title'),
            'note_text' => DB::raw('description'),
        ]);
    }

    public function down(): void
    {
        Schema::table('movie_notes', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'status']);
            $table->dropIndex(['sent_to', 'status']);
            $table->dropColumn([
                'tmdb_id',
                'movie_title',
                'poster_path',
                'release_year',
                'note_text',
            ]);
        });
    }
};
