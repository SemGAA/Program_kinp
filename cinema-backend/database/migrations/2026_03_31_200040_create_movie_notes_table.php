<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateMovieNotesTable extends Migration
{
    public function up()
    {
        Schema::create('movie_notes', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('movie_id')->nullable();
            $table->string('title');
            $table->text('description');
            $table->enum('status', ['pending', 'sent', 'accepted', 'rejected'])->default('pending');
            $table->unsignedBigInteger('sent_to')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('responded_at')->nullable();
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('sent_to')->references('id')->on('users')->onDelete('set null');
        });
    }

    public function down()
    {
        Schema::dropIfExists('movie_notes');
    }
}
