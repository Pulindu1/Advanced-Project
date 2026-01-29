<?php

namespace App\Http\Controllers;

use App\Models\Credential;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class PayController extends Controller
{
    /**
     * Get pay information for the authenticated user
     */
    public function index(Request $request): JsonResponse
    {
        // Get authenticated user's username from JWT token
        $username = $request->user()->username;
        
        // Get only the authenticated user's pay data
        $credential = Credential::where('username', $username)->first();

        if (!$credential) {
            return response()->json([
                'error' => 'Pay information not found'
            ], 404);
        }

        return response()->json([
            'employee_id' => $credential->employee_id,
            'username' => $credential->username,
            'department' => $credential->department,
            'position' => $credential->position,
            'hire_date' => $credential->hire_date->format('Y-m-d'),
            'monthly_pay' => (float) $credential->monthly_pay,
            'annual_pay' => (float) $credential->monthly_pay * 12,
        ]);
    }

    /**
     * Get pay information for a specific employee
     */
    public function show(string $employeeId): JsonResponse
    {
        $credential = Credential::where('employee_id', $employeeId)->first();

        if (!$credential) {
            return response()->json([
                'error' => 'Employee not found'
            ], 404);
        }

        return response()->json([
            'employee_id' => $credential->employee_id,
            'username' => $credential->username,
            'department' => $credential->department,
            'position' => $credential->position,
            'hire_date' => $credential->hire_date->format('Y-m-d'),
            'monthly_pay' => (float) $credential->monthly_pay,
            'annual_pay' => (float) $credential->monthly_pay * 12,
        ]);
    }
}
