<?php

namespace App\Http\Controllers;

use App\Models\Flag;
use Illuminate\Http\Request;

class FlagController extends Controller
{
    /**
     * Get the flag for the authenticated user
     * This is the secure endpoint - flag only returned if username matches
     */
    public function show(Request $request)
    {
        $user = $request->user();
        $flag = Flag::getForUser($user->username);

        if (!$flag) {
            return response()->json(['error' => 'Flag not found for user'], 404);
        }

        return response()->json(['flag' => $flag]);
    }
}
