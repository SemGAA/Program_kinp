<?php

use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Illuminate\Http\Request;
use App\Models\User;
use App\Models\MovieNote;
use App\Events\VideoSyncEvent;
use App\Events\MessageEvent;
use App\Events\MovieNoteEvent;

// Аутентификация
Route::post('/register', function (Request $request) {
    $user = User::create([
        'name' => $request->name,
        'email' => $request->email,
        'password' => bcrypt($request->password),
    ]);
    
    $token = $user->createToken('auth_token')->plainTextToken;
    
    return response()->json([
        'access_token' => $token,
        'token_type' => 'Bearer',
        'user' => $user
    ]);
});

Route::post('/login', function (Request $request) {
    if (!Auth::attempt($request->only('email', 'password'))) {
        return response()->json([
            'message' => 'Неверные учетные данные'
        ], 401);
    }
    
    $user = User::where('email', $request->email)->first();
    
    $token = $user->createToken('auth_token')->plainTextToken;
    
    return response()->json([
        'access_token' => $token,
        'token_type' => 'Bearer',
        'user' => $user
    ]);
});

Route::middleware('auth:sanctum')->post('/logout', function (Request $request) {
    $request->user()->currentAccessToken()->delete();
    
    return response()->json(['message' => 'Выход выполнен']);
});

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return response()->json($request->user());
});