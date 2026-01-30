<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\DB;

class EmployeeController extends Controller
{
    /**
     * "Basic" SQL injection protection - INTENTIONALLY BYPASSABLE
     * Blocks common patterns but misses advanced techniques
     * INTENTIONALLY BYPASSABLE using:
     * - SQL comment injection: O[comment]R instead of OR
     * - Case mixing with inline comments
     * - Double URL encoding
     */
    private function isBlocked(string $input): bool
    {
        // "Security" filter - checks for SQL keywords with spaces
        // VULNERABILITY: Filters only check for keywords with surrounding spaces
        // Bypass: Use inline comments like '/**/OR/**/1=1-- to replace spaces
        
        $dangerousPatterns = [
            '/\s+or\s+/i',      // Blocks " or " with spaces on both sides
            '/\s+and\s+/i',     // Blocks " and " with spaces on both sides
            '/union\s+select/i', // Blocks UNION SELECT
            '/;\s*--/',         // Blocks ; --
            '/drop\s+table/i',
            '/delete\s+from/i',
            '/insert\s+into/i',
        ];
        
        foreach ($dangerousPatterns as $pattern) {
            if (preg_match($pattern, $input)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * List employees with optional search/filter
     * INTENTIONALLY VULNERABLE - Uses raw SQL with bypassable protection
     */
    public function index(Request $request)
    {
        $search = $request->input('search', '');
        
        // "Basic" SQL injection protection - can be bypassed!
        if ($this->isBlocked($search)) {
            return response()->json([
                'error' => 'Invalid search query detected',
                'message' => 'Your search contains blocked characters'
            ], 400);
        }
        
        // If no search, use safe Eloquent query (filters out flag12)
        if (empty($search)) {
            return $this->safeIndex($request);
        }
        
        // VULNERABLE: Raw SQL query with string concatenation
        // The filter can be bypassed by removing the space after the quote
        // Simple single ILIKE condition makes injection straightforward
        $sql = "
            SELECT 
                e.id,
                e.employee_id,
                e.position,
                e.hire_date,
                e.notes,
                u.first_name,
                u.last_name,
                u.email,
                u.username,
                d.name as department
            FROM employees e
            JOIN users u ON e.user_id = u.id
            JOIN departments d ON e.department_id = d.id
            WHERE u.username ILIKE '%{$search}%' AND u.username != 'flag12'
            ORDER BY e.employee_id
        ";
        
        try {
            $employees = DB::select($sql);
            
            return response()->json([
                'data' => array_map(function($emp) {
                    return [
                        'id' => $emp->id,
                        'employee_id' => $emp->employee_id,
                        'position' => $emp->position,
                        'hire_date' => $emp->hire_date,
                        'department' => $emp->department,
                        'notes' => $emp->notes,
                        'user' => [
                            'first_name' => $emp->first_name,
                            'last_name' => $emp->last_name,
                            'email' => $emp->email,
                        ],
                    ];
                }, $employees),
                'total' => count($employees),
            ]);
        } catch (\Exception $e) {
            // Return SQL error for CTF hints
            return response()->json([
                'error' => 'Database error',
                'message' => $e->getMessage(),
            ], 500);
        }
    }
    
    /**
     * Safe employee list - filters out flag12
     */
    private function safeIndex(Request $request)
    {
        $query = Employee::with(['user:id,username,email,first_name,last_name', 'department:id,name,code'])
            ->whereHas('user', function($q) {
                $q->where('username', '!=', 'flag12');
            });

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
