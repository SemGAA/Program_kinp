<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\FriendshipController;
use App\Http\Controllers\Api\MovieController;
use App\Http\Controllers\Api\NoteController;
use App\Http\Controllers\Api\WatchRoomController;
use Illuminate\Support\Facades\Route;

Route::get('/ping', static fn () => response()->json([
    'ok' => true,
    'timestamp' => now()->toIso8601String(),
]));

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);

    Route::get('/movies/search', [MovieController::class, 'search']);
    Route::get('/movies/{tmdbId}', [MovieController::class, 'show'])->whereNumber('tmdbId');
    Route::get('/movies/{tmdbId}/recommendations', [MovieController::class, 'recommendations'])->whereNumber('tmdbId');

    Route::get('/notes', [NoteController::class, 'index']);
    Route::post('/notes', [NoteController::class, 'store']);
    Route::patch('/notes/{movieNote}', [NoteController::class, 'update']);
    Route::post('/notes/{movieNote}/share', [NoteController::class, 'share']);
    Route::post('/notes/{movieNote}/accept', [NoteController::class, 'accept']);
    Route::post('/notes/{movieNote}/reject', [NoteController::class, 'reject']);

    Route::get('/friends', [FriendshipController::class, 'friends']);
    Route::get('/friend-requests', [FriendshipController::class, 'requests']);
    Route::post('/friend-requests', [FriendshipController::class, 'store']);
    Route::post('/friend-requests/{friendship}/accept', [FriendshipController::class, 'accept']);
    Route::post('/friend-requests/{friendship}/reject', [FriendshipController::class, 'reject']);

    Route::get('/watch-rooms', [WatchRoomController::class, 'index']);
    Route::post('/watch-rooms', [WatchRoomController::class, 'store']);
    Route::post('/watch-rooms/join', [WatchRoomController::class, 'join']);
    Route::get('/watch-rooms/{code}', [WatchRoomController::class, 'show']);
    Route::post('/watch-rooms/{code}/sync', [WatchRoomController::class, 'sync']);
    Route::post('/watch-rooms/{code}/messages', [WatchRoomController::class, 'sendMessage']);
});
