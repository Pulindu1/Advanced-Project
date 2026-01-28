<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Department;
use App\Models\Employee;
use App\Models\Flag;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Create departments
        $departments = [
            Department::create([
                'name' => 'Engineering',
                'code' => 'ENG',
                'description' => 'Software development and infrastructure',
            ]),
            Department::create([
                'name' => 'Human Resources',
                'code' => 'HR',
                'description' => 'Employee management and recruitment',
            ]),
            Department::create([
                'name' => 'Finance',
                'code' => 'FIN',
                'description' => 'Financial operations and accounting',
            ]),
            Department::create([
                'name' => 'Operations',
                'code' => 'OPS',
                'description' => 'Day-to-day business operations',
            ]),
        ];

        $positions = [
            'Software Engineer',
            'Junior Developer',
            'Data Analyst',
            'Systems Administrator',
            'Technical Support',
            'Project Coordinator',
        ];

        // Load flags from flags.json - this determines which player accounts to create
        $flagsFile = dirname(__DIR__, 3) . '/flags.json';
        if (!file_exists($flagsFile)) {
            $this->command->error('flags.json not found! Run the challenge generator first:');
            $this->command->error('  cd CTFs/challenge-generation');
            $this->command->error('  node chgen_ctf3.js --count 10');
            return;
        }

        $flags = json_decode(file_get_contents($flagsFile), true);
        if (!is_array($flags) || empty($flags)) {
            $this->command->error('flags.json is empty or invalid!');
            return;
        }

        $this->command->info("Found " . count($flags) . " players in flags.json");

        // Create a user account for each player in flags.json
        $empNum = 1;
        foreach ($flags as $username => $flagValue) {
            // Validate username format (4 letters + 2 numbers)
            if (!preg_match('/^[a-z]{4}[0-9]{2}$/', $username)) {
                $this->command->warn("Skipping invalid username: $username");
                continue;
            }

            // Pick random department and position
            $dept = $departments[array_rand($departments)];
            $position = $positions[array_rand($positions)];

            // Create user with 'password' as password (simple for CTF)
            $user = User::create([
                'username' => $username,
                'email' => $username . '@company.internal',
                'password' => Hash::make('password'), // Password is 'password' for all users
                'first_name' => ucfirst(substr($username, 0, 2)),
                'last_name' => ucfirst(substr($username, 2, 2)),
                'role' => 'employee',
                'department_id' => $dept->id,
                'is_active' => true,
            ]);

            Employee::create([
                'user_id' => $user->id,
                'employee_id' => 'EMP' . str_pad($empNum++, 3, '0', STR_PAD_LEFT),
                'department_id' => $dept->id,
                'position' => $position,
                'salary' => rand(50000, 90000),
                'hire_date' => now()->subMonths(rand(1, 36))->format('Y-m-d'),
            ]);

            // Store the flag for this user
            Flag::create([
                'username' => $username,
                'flag_value' => $flagValue,
            ]);

            $this->command->info("Created player: $username");
        }

        $this->command->info('');
        $this->command->info('Database seeded successfully!');
        $this->command->info('');
        $this->command->info('Player credentials (password = password):');
        foreach (array_keys($flags) as $username) {
            if (preg_match('/^[a-z]{4}[0-9]{2}$/', $username)) {
                $this->command->info("  $username / password");
            }
        }
    }
}
