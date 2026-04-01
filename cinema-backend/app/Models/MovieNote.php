<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MovieNote extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'tmdb_id',
        'media_type',
        'movie_title',
        'poster_path',
        'release_year',
        'note_text',
        'movie_id',
        'title',
        'description',
        'status',
        'sent_to',
        'sent_at',
        'responded_at'
    ];

    protected $casts = [
        'tmdb_id' => 'integer',
        'release_year' => 'integer',
        'sent_at' => 'datetime',
        'responded_at' => 'datetime',
    ];

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function recipient(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sent_to');
    }
}
