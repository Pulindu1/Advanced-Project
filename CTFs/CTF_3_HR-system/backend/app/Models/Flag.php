<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Flag extends Model
{
    use HasFactory;

    protected $fillable = [
        'username',
        'flag_value',
    ];

    protected $hidden = [
        'flag_value', // Only revealed to authenticated user matching username
    ];

    /**
     * Get flag for a specific user (secure access)
     */
    public static function getForUser(string $username): ?string
    {
        $flag = self::where('username', strtolower($username))->first();
        return $flag?->flag_value;
    }
}
