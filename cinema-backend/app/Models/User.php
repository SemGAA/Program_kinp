<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens;
    use HasFactory;
    use Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function notes(): HasMany
    {
        return $this->hasMany(MovieNote::class);
    }

    public function receivedNotes(): HasMany
    {
        return $this->hasMany(MovieNote::class, 'sent_to');
    }

    public function requestedFriendships(): HasMany
    {
        return $this->hasMany(Friendship::class, 'requested_by_id');
    }

    public function friendshipsAsUserOne(): HasMany
    {
        return $this->hasMany(Friendship::class, 'user_one_id');
    }

    public function friendshipsAsUserTwo(): HasMany
    {
        return $this->hasMany(Friendship::class, 'user_two_id');
    }
}
