<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Employee extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'employee_id',
        'department_id',
        'position',
        'salary',
        'hire_date',
        'phone',
        'address',
        'emergency_contact',
        'notes',
    ];

    protected $hidden = [
        'salary', // Sensitive - only visible to HR/Admin
    ];

    protected function casts(): array
    {
        return [
            'hire_date' => 'date',
            'salary' => 'decimal:2',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function department()
    {
        return $this->belongsTo(Department::class);
    }

    public function managedDepartment()
    {
        return $this->hasOne(Department::class, 'manager_id');
    }

    /**
     * Reveal salary only to authorized users
     */
    public function getSalaryForUser(User $viewer): ?string
    {
        if ($viewer->isHR() || $viewer->id === $this->user_id) {
            return $this->salary;
        }
        return null;
    }
}
