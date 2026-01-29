<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\EmployeeController;
use App\Http\Controllers\DepartmentController;
use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\FlagController;
use App\Http\Controllers\PayController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// Public routes (with rate limiting)
Route::middleware('throttle:api')->group(function () {
    Route::post('/auth/login', [AuthController::class, 'login']);
});

// Test route without middleware
Route::get('/test', function () {
    return response()->json(['message' => 'API is working']);
});

// Protected routes
Route::middleware(['auth.jwt'])->group(function () {
    // Auth
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::post('/auth/refresh', [AuthController::class, 'refresh']);
    Route::get('/auth/me', [AuthController::class, 'me']);

    // Dashboard (all authenticated users)
    Route::get('/dashboard/stats', [DashboardController::class, 'stats']);
    Route::get('/dashboard/activity', [DashboardController::class, 'recentActivity']);

    // Employees (read: all users, write: HR/Admin)
    Route::get('/employees', [EmployeeController::class, 'index']);
    Route::get('/employees/{id}', [EmployeeController::class, 'show']);
    
    Route::middleware(['role:hr,admin'])->group(function () {
        Route::post('/employees', [EmployeeController::class, 'store']);
        Route::put('/employees/{id}', [EmployeeController::class, 'update']);
    });
    
    Route::middleware(['role:admin'])->group(function () {
        Route::delete('/employees/{id}', [EmployeeController::class, 'destroy']);
    });

    // Departments
    Route::get('/departments', [DepartmentController::class, 'index']);
    Route::get('/departments/{id}', [DepartmentController::class, 'show']);
    
    Route::middleware(['role:admin'])->group(function () {
        Route::post('/departments', [DepartmentController::class, 'store']);
        Route::put('/departments/{id}', [DepartmentController::class, 'update']);
        Route::delete('/departments/{id}', [DepartmentController::class, 'destroy']);
    });

    // Pay (all authenticated users can view pay information)
    Route::get('/pay', [PayController::class, 'index']);
    Route::get('/pay/{employeeId}', [PayController::class, 'show']);

    // Audit Logs (Admin only)
    Route::middleware(['role:admin'])->group(function () {
        Route::get('/audit-logs', [AuditLogController::class, 'index']);
        Route::get('/audit-logs/actions', [AuditLogController::class, 'actions']);
        Route::get('/audit-logs/resource-types', [AuditLogController::class, 'resourceTypes']);
        Route::get('/audit-logs/{id}', [AuditLogController::class, 'show']);
    });

    // Flag (secure - only returns flag for authenticated user)
    Route::get('/flag', [FlagController::class, 'show']);
});
