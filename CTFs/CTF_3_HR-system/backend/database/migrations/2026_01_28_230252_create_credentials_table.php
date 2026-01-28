<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Intentionally vulnerable credentials table for SQL injection challenge
     * Stores plaintext passwords for exploitation
     */
    public function up(): void
    {
        Schema::create('credentials', function (Blueprint $table) {
            $table->string('username', 50)->primary();
            $table->string('password', 255); // Plaintext password (INTENTIONALLY INSECURE)
            $table->string('password_hint', 255)->nullable();
            $table->string('employee_id', 10);
            $table->string('department', 100);
            $table->string('position', 100);
            $table->date('hire_date');
            $table->timestamp('last_login')->nullable();
            $table->timestamps();
            
            // Index for faster queries
            $table->index('username');
            $table->index('employee_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('credentials');
    }
};
