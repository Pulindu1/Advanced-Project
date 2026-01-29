<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Credential extends Model
{
    protected $table = 'credentials';
    protected $primaryKey = 'username';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'username',
        'password',
        'password_hint',
        'employee_id',
        'department',
        'position',
        'hire_date',
        'monthly_pay',
        'last_login',
    ];

    protected $casts = [
        'hire_date' => 'date',
        'last_login' => 'datetime',
        'monthly_pay' => 'decimal:2',
    ];

    /**
     * Relationship to User
     */
    public function user()
    {
        return $this->belongsTo(User::class, 'username', 'username');
    }
}
