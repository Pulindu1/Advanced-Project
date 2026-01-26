<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('flags', function (Blueprint $table) {
            $table->id();
            $table->string('username', 50)->unique();
            $table->string('flag_value', 100);
            $table->timestamps();
            
            $table->index('username');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('flags');
    }
};
