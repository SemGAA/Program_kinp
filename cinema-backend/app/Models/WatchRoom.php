<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WatchRoom extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'host_user_id',
        'tmdb_id',
        'movie_title',
        'poster_path',
        'release_year',
        'video_url',
        'playback_state',
        'playback_position_ms',
        'playback_rate',
        'last_synced_at',
        'last_synced_by_user_id',
    ];

    protected $casts = [
        'last_synced_at' => 'datetime',
        'playback_position_ms' => 'integer',
        'playback_rate' => 'float',
        'release_year' => 'integer',
        'tmdb_id' => 'integer',
    ];

    public function host(): BelongsTo
    {
        return $this->belongsTo(User::class, 'host_user_id');
    }

    public function lastSyncedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'last_synced_by_user_id');
    }

    public function members(): HasMany
    {
        return $this->hasMany(WatchRoomMember::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(WatchRoomMessage::class);
    }
}
