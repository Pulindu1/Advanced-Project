<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\AuditLog;
use Illuminate\Http\Request;

class DepartmentController extends Controller
{
    /**
     * List all departments
     */
    public function index(Request $request)
    {
        $departments = Department::withCount('employees')
            ->with('manager:id,employee_id,position')
            ->orderBy('name')
            ->get();

        return response()->json(['departments' => $departments]);
    }

    /**
     * Get single department
     */
    public function show(Request $request, int $id)
    {
        $department = Department::with(['employees.user:id,first_name,last_name', 'manager'])
            ->findOrFail($id);

        AuditLog::logAction($request->user()->id, 'view', 'department', $id);

        return response()->json(['department' => $department]);
    }

    /**
     * Create department (Admin only)
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100|unique:departments,name',
            'code' => 'required|string|max:10|unique:departments,code',
            'description' => 'nullable|string|max:500',
            'manager_id' => 'nullable|exists:employees,id',
        ]);

        $department = Department::create($validated);

        AuditLog::logAction(
            $request->user()->id,
            'create',
            'department',
            $department->id,
            null,
            $validated
        );

        return response()->json(['department' => $department], 201);
    }

    /**
     * Update department (Admin only)
     */
    public function update(Request $request, int $id)
    {
        $department = Department::findOrFail($id);
        $oldValues = $department->toArray();

        $validated = $request->validate([
            'name' => 'sometimes|string|max:100|unique:departments,name,' . $id,
            'code' => 'sometimes|string|max:10|unique:departments,code,' . $id,
            'description' => 'nullable|string|max:500',
            'manager_id' => 'nullable|exists:employees,id',
        ]);

        $department->update($validated);

        AuditLog::logAction(
            $request->user()->id,
            'update',
            'department',
            $id,
            $oldValues,
            $validated
        );

        return response()->json(['department' => $department->fresh()]);
    }

    /**
     * Delete department (Admin only)
     */
    public function destroy(Request $request, int $id)
    {
        $department = Department::findOrFail($id);

        // Prevent deletion if employees exist
        if ($department->employees()->exists()) {
            return response()->json([
                'error' => 'Cannot delete department with employees'
            ], 422);
        }

        $oldValues = $department->toArray();
        $department->delete();

        AuditLog::logAction(
            $request->user()->id,
            'delete',
            'department',
            $id,
            $oldValues,
            null
        );

        return response()->json(['message' => 'Department deleted']);
    }
}
