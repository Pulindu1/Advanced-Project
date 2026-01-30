<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;

class DebugController extends Controller
{
    /**
     * Debug endpoint - VULNERABLE to path traversal
     * TODO: Remove before production deployment
     * 
     * Allows fetching user configuration files
     * VULNERABILITY: No input sanitization on username parameter
     */
    public function getUserConfig(Request $request)
    {
        // Get username from query parameter
        $username = $request->query('user', '');
        
        if (empty($username)) {
            return response()->json([
                'error' => 'Missing user parameter',
                'hint' => 'Try: /api/debug/config?user=<username>'
            ], 400);
        }
        
        // VULNERABLE: Direct file access without sanitization
        // This allows reading credentials.json for any user
        // Try multiple common locations
        $possiblePaths = [
            base_path('credentials.json'),
            base_path('../credentials.json'),
            base_path('../../CTF_3_HR-system/credentials.json'),
        ];
        
        $credentialsPath = null;
        foreach ($possiblePaths as $path) {
            if (File::exists($path)) {
                $credentialsPath = $path;
                break;
            }
        }
        
        if (!$credentialsPath) {
            return response()->json([
                'error' => 'Configuration file not found',
                'paths_checked' => $possiblePaths
            ], 404);
        }
        
        $credentials = json_decode(File::get($credentialsPath), true);
        
        // VULNERABILITY: Returns raw credentials without proper authorization
        if (isset($credentials[$username])) {
            return response()->json([
                'debug' => true,
                'user' => $username,
                'config' => $credentials[$username],
                'warning' => 'Debug endpoint - not for production use'
            ]);
        }
        
        return response()->json([
            'error' => 'User not found',
            'searched_for' => $username,
            'hint' => 'Check available usernames in employee data'
        ], 404);
    }

    /**
     * List available debug endpoints
     */
    public function index()
    {
        return response()->json([
            'debug_endpoints' => [
                'config' => '/api/debug/config?user=<username>',
            ],
            'usage_example' => [
                'step1' => 'Login: curl -X POST http://127.0.0.1:8004/api/auth/login -H "Content-Type: application/json" -d \'{"username":"your_user","password":"your_pass"}\' | grep -o \'^"token":"[^"]*"\' | cut -d\'"\' -f4',
                'step2' => 'Query: curl "http://127.0.0.1:8004/api/debug/config?user=<username>" -H "Authorization: Bearer <token>"'
            ],
            'warning' => 'These endpoints should be disabled in production'
        ]);
    }
}
