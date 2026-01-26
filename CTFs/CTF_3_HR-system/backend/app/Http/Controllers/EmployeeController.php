<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class EmployeeController extends Controller
{
    /**
     * List employees with optional search/filter
     * All authenticated users can see basic info
     */
    public function index(Request $request)
    {
        $query = Employee::with(['user:id,username,email,first_name,last_name', 'department:id,name,code']);

        // Search by name or employee ID (parameterized - secure)
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('employee_id', 'ILIKE', '%' . $search . '%')
                  ->orWhereHas('user', function ($uq) use ($search) {
                      $uq->where('first_name', 'ILIKE', '%' . $search . '%')
                         ->orWhere('last_name', 'ILIKE', '%' . $search . '%')
                         ->orWhere('email', 'ILIKE', '%' . $search . '%');
                  });
            });
        }

        // Filter by department
        if ($deptId = $request->input('department_id')) {
            $query->where('department_id', (int)$deptId);
        }

        $employees = $query->orderBy('employee_id')->paginate(20);

        // Hide sensitive fields based on role
        $user = $request->user();
        $employees->getCollection()->transform(function ($emp) use ($user) {
            $data = [
                'id' => $emp->id,
                'employee_id' => $emp->employee_id,
                'position' => $emp->position,
                'hire_date' => $emp->hire_date?->format('Y-m-d'),
                'department' => $emp->department?->name,
                'user' => [
                    'first_name' => $emp->user?->first_name,
                    'last_name' => $emp->user?->last_name,
                    'email' => $emp->user?->email,
                ],
            ];

            // Only HR/Admin can see salary
            if ($user->isHR()) {
                $data['salary'] = $emp->salary;
                $data['phone'] = $emp->phone;
                $data['address'] = $emp->address;
            }

            return $data;
        });

        return response()->json($employees);
    }

    /**
     * Get single employee details
     */
    public function show(Request $request, int $id)
    {
        $employee = Employee::with(['user', 'department'])->findOrFail($id);
        $user = $request->user();

        $data = [
            'id' => $employee->id,
            'employee_id' => $employee->employee_id,
            'position' => $employee->position,
            'hire_date' => $employee->hire_date?->format('Y-m-d'),
            'department' => $employee->department,
            'user' => [
                'id' => $employee->user?->id,
                'first_name' => $employee->user?->first_name,
                'last_name' => $employee->user?->last_name,
                'email' => $employee->user?->email,
            ],
        ];

        // Sensitive data only for HR/Admin or self
        if ($user->isHR() || $user->id === $employee->user_id) {
            $data['salary'] = $employee->salary;
            $data['phone'] = $employee->phone;
            $data['address'] = $employee->address;
            $data['emergency_contact'] = $employee->emergency_contact;
            $data['notes'] = $employee->notes;
        }

        AuditLog::logAction($user->id, 'view', 'employee', $id);

        return response()->json(['employee' => $data]);
    }

    /**
     * Create employee (HR/Admin only)
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'user_id' => 'required|exists:users,id|unique:employees,user_id',
            'employee_id' => 'required|string|max:20|unique:employees,employee_id',
            'department_id' => 'required|exists:departments,id',
            'position' => 'required|string|max:100',
            'salary' => 'required|numeric|min:0',
            'hire_date' => 'required|date',
            'phone' => 'nullable|string|max:20',
            'address' => 'nullable|string|max:500',
            'emergency_contact' => 'nullable|string|max:200',
            'notes' => 'nullable|string|max:1000',
        ]);

        $employee = Employee::create($validated);

        AuditLog::logAction(
            $request->user()->id,
            'create',
            'employee',
            $employee->id,
            null,
            $validated
        );

        return response()->json(['employee' => $employee], 201);
    }

    /**
     * Update employee (HR/Admin only)
     */
    public function update(Request $request, int $id)
    {
        $employee = Employee::findOrFail($id);
        $oldValues = $employee->toArray();

        $validated = $request->validate([
            'department_id' => 'sometimes|exists:departments,id',
            'position' => 'sometimes|string|max:100',
            'salary' => 'sometimes|numeric|min:0',
            'phone' => 'nullable|string|max:20',
            'address' => 'nullable|string|max:500',
            'emergency_contact' => 'nullable|string|max:200',
            'notes' => 'nullable|string|max:1000',
        ]);

        $employee->update($validated);

        AuditLog::logAction(
            $request->user()->id,
            'update',
            'employee',
            $id,
            $oldValues,
            $validated
        );

        return response()->json(['employee' => $employee->fresh()]);
    }

    /**
     * Delete employee (Admin only)
     */
    public function destroy(Request $request, int $id)
    {
        $employee = Employee::findOrFail($id);
        $oldValues = $employee->toArray();

        $employee->delete();

        AuditLog::logAction(
            $request->user()->id,
            'delete',
            'employee',
            $id,
            $oldValues,
            null
        );

        return response()->json(['message' => 'Employee deleted']);
    }
}
