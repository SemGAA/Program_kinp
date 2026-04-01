<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Friendship extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_one_id',
        'user_two_id',
        'requested_by_id',
        'status',
        'responded_at',
    ];

    protected $casts = [
        'responded_at' => 'datetime',
    ];

    public static function pairFor(int $firstUserId, int $secondUserId): array
    {
        return [
            min($firstUserId, $secondUserId),
            max($firstUserId, $secondUserId),
        ];
    }

    public function userOne(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_one_id');
    }

    public function userTwo(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_two_id');
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by_id');
    }

    public function otherUser(User $user): User
    {
        return $this->user_one_id === $user->id ? $this->userTwo : $this->userOne;
    }

    public function isRequestedBy(User $user): bool
    {
        return $this->requested_by_id === $user->id;
    }
}
