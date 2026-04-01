<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WatchRoomMessage extends Model
{
    use HasFactory;

    protected $fillable = [
        'watch_room_id',
        'user_id',
        'kind',
        'body',
    ];

    public function room(): BelongsTo
    {
        return $this->belongsTo(WatchRoom::class, 'watch_room_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
