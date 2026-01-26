<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    /**
     * List audit logs (Admin only)
     */
    public function index(Request $request)
    {
        $query = AuditLog::with('user:id,username,first_name,last_name');

        // Filter by action
        if ($action = $request->input('action')) {
            $query->where('action', $action);
        }

        // Filter by resource type
        if ($resourceType = $request->input('resource_type')) {
            $query->where('resource_type', $resourceType);
        }

        // Filter by user
        if ($userId = $request->input('user_id')) {
            $query->where('user_id', (int)$userId);
        }

        // Filter by date range
        if ($from = $request->input('from')) {
            $query->where('created_at', '>=', $from);
        }
        if ($to = $request->input('to')) {
            $query->where('created_at', '<=', $to);
        }

        $logs = $query->orderByDesc('created_at')->paginate(50);

        return response()->json($logs);
    }

    /**
     * Get single audit log entry
     */
    public function show(Request $request, int $id)
    {
        $log = AuditLog::with('user:id,username,first_name,last_name')->findOrFail($id);

        return response()->json(['log' => $log]);
    }

    /**
     * Get available action types for filtering
     */
    public function actions()
    {
        $actions = AuditLog::distinct('action')->pluck('action');
        return response()->json(['actions' => $actions]);
    }

    /**
     * Get available resource types for filtering
     */
    public function resourceTypes()
    {
        $types = AuditLog::distinct('resource_type')->pluck('resource_type');
        return response()->json(['resource_types' => $types]);
    }
}
