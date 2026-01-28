<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;
use Firebase\JWT\JWT;

class AuthController extends Controller
{
    /**
     * Login with rate limiting
     */
    public function login(Request $request)
    {
        try {
            \Log::info('Login attempt started');
            
            $request->validate([
                'username' => 'required|string|max:255',
                'password' => 'required|string',
            ]);

            $username = $request->input('username');
            \Log::info('Login for user: ' . $username);
            
            $key = 'login_' . $request->ip() . '_' . $username;
            
        if (RateLimiter::tooManyAttempts($key, 5)) {
            $seconds = RateLimiter::availableIn($key);
            AuditLog::logAction(null, 'login_rate_limited', 'auth', null, null, ['username' => $username]);
            
            return response()->json([
                'error' => 'Too many login attempts',
                'retry_after' => $seconds,
            ], 429);
        }

        $user = User::where('username', $username)->first();
        \Log::info('User found: ' . ($user ? 'yes' : 'no'));

        if (!$user || !Hash::check($request->password, $user->password)) {
            RateLimiter::hit($key, 60);
            AuditLog::logAction(null, 'login_failed', 'auth', null, null, ['username' => $username]);
            
            return response()->json(['error' => 'Invalid credentials'], 401);
        }

        if (!$user->is_active) {
            AuditLog::logAction($user->id, 'login_inactive', 'auth');
            return response()->json(['error' => 'Account is deactivated'], 403);
        }

        // Clear rate limiter on success
        RateLimiter::clear($key);

        // Generate JWT
        \Log::info('Generating JWT token');
        $payload = [
            'iss' => config('app.url'),
            'sub' => $user->id,
            'username' => $user->username,
            'role' => $user->role,
            'iat' => time(),
            'exp' => time() + (config('jwt.ttl') * 60),
        ];

        $token = JWT::encode($payload, config('jwt.secret'), config('jwt.algo'));
        \Log::info('JWT token generated successfully');

        AuditLog::logAction($user->id, 'login_success', 'auth');

        return response()->json([
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'username' => $user->username,
                'email' => $user->email,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'role' => $user->role,
            ],
            'expires_in' => config('jwt.ttl') * 60,
        ]);
        } catch (\Exception $e) {
            \Log::error('Login error: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'error' => 'Login failed: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get current user info
     */
    public function me(Request $request)
    {
        $user = $request->user();

        return response()->json([
            'user' => [
                'id' => $user->id,
                'username' => $user->username,
                'email' => $user->email,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'role' => $user->role,
                'department' => $user->department?->name,
            ],
        ]);
    }

    /**
     * Logout (client-side token invalidation)
     */
    public function logout(Request $request)
    {
        AuditLog::logAction($request->user()?->id, 'logout', 'auth');
        
        return response()->json(['message' => 'Logged out successfully']);
    }

    /**
     * Refresh token
     */
    public function refresh(Request $request)
    {
        $user = $request->user();

        $payload = [
            'iss' => config('app.url'),
            'sub' => $user->id,
            'username' => $user->username,
            'role' => $user->role,
            'iat' => time(),
            'exp' => time() + (config('jwt.ttl') * 60),
        ];

        $token = JWT::encode($payload, config('jwt.secret'), config('jwt.algo'));

        return response()->json([
            'token' => $token,
            'expires_in' => config('jwt.ttl') * 60,
        ]);
    }
}
