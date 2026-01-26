<?php

namespace App\Http\Middleware;

use Closure;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\Request;
use App\Models\User;
use App\Models\AuditLog;

class JwtMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        $token = $request->bearerToken();

        if (!$token) {
            return response()->json(['error' => 'Token not provided'], 401);
        }

        try {
            $secret = config('jwt.secret');
            $decoded = JWT::decode($token, new Key($secret, config('jwt.algo')));

            $user = User::where('id', $decoded->sub)->where('is_active', true)->first();

            if (!$user) {
                AuditLog::logAction(null, 'auth_failed', 'jwt', null, null, ['reason' => 'user_not_found']);
                return response()->json(['error' => 'User not found or inactive'], 401);
            }

            // Attach user to request
            $request->merge(['auth_user' => $user]);
            $request->setUserResolver(fn() => $user);

        } catch (\Firebase\JWT\ExpiredException $e) {
            return response()->json(['error' => 'Token expired'], 401);
        } catch (\Exception $e) {
            AuditLog::logAction(null, 'auth_failed', 'jwt', null, null, ['reason' => $e->getMessage()]);
            return response()->json(['error' => 'Invalid token'], 401);
        }

        return $next($request);
    }
}
