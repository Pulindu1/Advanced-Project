<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\User;
use App\Models\Department;
use App\Models\AuditLog;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    /**
     * Get dashboard statistics
     */
    public function stats(Request $request)
    {
        $user = $request->user();

        $stats = [
            'total_employees' => Employee::count(),
            'total_departments' => Department::count(),
            'total_users' => User::where('is_active', true)->count(),
        ];

        // Additional stats for HR/Admin
        if ($user->isHR()) {
            $stats['recent_hires'] = Employee::where('hire_date', '>=', now()->subDays(30))->count();
            $stats['avg_salary'] = Employee::avg('salary');
        }

        // Admin-only stats
        if ($user->isAdmin()) {
            $stats['audit_logs_today'] = AuditLog::whereDate('created_at', today())->count();
            $stats['failed_logins_today'] = AuditLog::where('action', 'login_failed')
                ->whereDate('created_at', today())
                ->count();
        }

        return response()->json(['stats' => $stats]);
    }

    /**
     * Get recent activity for dashboard
     */
    public function recentActivity(Request $request)
    {
        $user = $request->user();

        // Regular employees see only their own activity
        $query = AuditLog::with('user:id,username,first_name,last_name')
            ->orderByDesc('created_at')
            ->limit(10);

        if (!$user->isAdmin()) {
            $query->where('user_id', $user->id);
        }

        $activity = $query->get()->map(fn($log) => [
            'id' => $log->id,
            'action' => $log->action,
            'resource_type' => $log->resource_type,
            'resource_id' => $log->resource_id,
            'user' => $log->user?->username,
            'created_at' => $log->created_at?->diffForHumans(),
        ]);

        return response()->json(['activity' => $activity]);
    }
}
