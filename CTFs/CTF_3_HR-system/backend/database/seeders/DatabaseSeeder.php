<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Department;
use App\Models\Employee;
use App\Models\Flag;
use App\Models\Credential;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Create departments (idempotent - safe to re-run on restart)
        $departments = [
            Department::firstOrCreate(['name' => 'Engineering'], ['code' => 'ENG', 'description' => 'Software development and infrastructure']),
            Department::firstOrCreate(['name' => 'Human Resources'], ['code' => 'HR', 'description' => 'Employee management and recruitment']),
            Department::firstOrCreate(['name' => 'Finance'], ['code' => 'FIN', 'description' => 'Financial operations and accounting']),
            Department::firstOrCreate(['name' => 'Operations'], ['code' => 'OPS', 'description' => 'Day-to-day business operations']),
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
            $this->command->error('  node chgen_basic1.js --count 10');
            $this->command->error('  node generate_credentials.js');
            return;
        }

        $flags = json_decode(file_get_contents($flagsFile), true);
        if (!is_array($flags) || empty($flags)) {
            $this->command->error('flags.json is empty or invalid!');
            return;
        }

        // Load credentials from credentials.json
        $credentialsFile = dirname(__DIR__, 3) . '/credentials.json';
        if (!file_exists($credentialsFile)) {
            $this->command->error('credentials.json not found! Run the credentials generator:');
            $this->command->error('  cd CTFs/challenge-generation');
            $this->command->error('  node generate_credentials.js');
            return;
        }

        $credentials = json_decode(file_get_contents($credentialsFile), true);
        if (!is_array($credentials) || empty($credentials)) {
            $this->command->error('credentials.json is empty or invalid!');
            return;
        }

        $this->command->info("Found " . count($flags) . " players in flags.json");
        $this->command->info("Found " . count($credentials) . " credentials in credentials.json");

        // Create a user account for each player in flags.json
        foreach ($flags as $username => $flagValue) {
            // Handle special flag12 user (hidden employee for CTF)
            if ($username === 'flag12') {
                $this->createHiddenEmployee($username, $credentials[$username], $departments);
                continue;
            }
            
            // Validate username format (4 letters + 2 numbers)
            if (!preg_match('/^[a-z]{4}[0-9]{2}$/', $username)) {
                $this->command->warn("Skipping invalid username: $username");
                continue;
            }

            // Get credential data from credentials.json
            if (!isset($credentials[$username])) {
                $this->command->warn("No credentials found for $username, skipping");
                continue;
            }

            $credData = $credentials[$username];
            
            // Support both old format (string password) and new format (object with details)
            if (is_string($credData)) {
                // Old format - generate random data
                $userPassword = $credData;
                $employeeId = 'EMP' . str_pad(array_search($username, array_keys($credentials)) + 1, 3, '0', STR_PAD_LEFT);
                $dept = $departments[array_rand($departments)];
                $position = $positions[array_rand($positions)];
                $hireDate = now()->subMonths(rand(1, 36))->format('Y-m-d');
                $monthlyPay = rand(4000, 10000);
            } else {
                // New format - use data from credentials.json
                $userPassword = $credData['password'];
                $employeeId = $credData['employee_id'];
                $credDeptName = $credData['department'];
                $position = $credData['position'];
                $hireDate = $credData['hire_date'];
                $monthlyPay = $credData['monthly_pay'] ?? rand(4000, 10000);
                
                // Find matching department
                $dept = collect($departments)->first(function($d) use ($credDeptName) {
                    return $d->name === $credDeptName;
                });
                
                if (!$dept) {
                    $this->command->warn("Department '$credDeptName' not found for $username, using random");
                    $dept = $departments[array_rand($departments)];
                }
            }

            // Create user (idempotent - skip if already exists)
            $user = User::firstOrCreate(
                ['username' => $username],
                [
                    'email' => $username . '@company.internal',
                    'password' => Hash::make($userPassword),
                    'first_name' => ucfirst(substr($username, 0, 2)),
                    'last_name' => ucfirst(substr($username, 2, 2)),
                    'role' => 'employee',
                    'department_id' => $dept->id,
                    'is_active' => true,
                ]
            );

            Employee::firstOrCreate(
                ['employee_id' => $employeeId],
                [
                    'user_id' => $user->id,
                    'department_id' => $dept->id,
                    'position' => $position,
                    'salary' => rand(50000, 90000),
                    'hire_date' => $hireDate,
                ]
            );

            // Store the flag for this user
            Flag::firstOrCreate(
                ['username' => $username],
                ['flag_value' => $flagValue]
            );

            // Store credentials in vulnerable table (PLAINTEXT - for SQL injection challenge)
            Credential::firstOrCreate(
                ['username' => $username],
                [
                    'password' => $userPassword, // PLAINTEXT PASSWORD (intentionally insecure)
                    'password_hint' => 'Contact HR if you forgot your password',
                    'employee_id' => $employeeId,
                    'department' => $dept->name,
                    'position' => $position,
                    'hire_date' => $hireDate,
                    'monthly_pay' => $monthlyPay,
                ]
            );

            $this->command->info("Created player: $username (password: $userPassword, dept: {$dept->name})");
        }

        $this->command->info('');
        $this->command->info('Database seeded successfully!');
        $this->command->info('');
        $this->command->info('Player credentials:');
        foreach (array_keys($flags) as $username) {
            if (preg_match('/^[a-z]{4}[0-9]{2}$/', $username)) {
                $credData = $credentials[$username] ?? 'password';
                $pwd = is_string($credData) ? $credData : $credData['password'];
                $this->command->info("  $username / $pwd");
            }
        }
        $this->command->info('');
        $this->command->info('NOTE: Credentials table contains PLAINTEXT passwords + employee data');
        $this->command->info('      This is INTENTIONALLY VULNERABLE for SQL injection challenge');
        $this->command->info('');
        $this->command->info('CTF SETUP: Hidden employee flag12 created (not visible in normal queries)');
    }

    /**
     * Create the hidden flag12 employee for CTF challenge
     */
    private function createHiddenEmployee(string $username, array $credData, array $departments): void
    {
        // Find the Operations department for flag12
        $dept = collect($departments)->first(fn($d) => $d->name === 'Operations');
        if (!$dept) {
            $dept = $departments[0];
        }

        // Create user (idempotent - not meant to be logged into)
        $user = User::firstOrCreate(
            ['username' => $username],
            [
                'email' => $username . '@system.internal',
                'password' => Hash::make('SYSTEM_INTERNAL_DO_NOT_USE'),
                'first_name' => 'Hidden',
                'last_name' => 'Employee',
                'role' => 'employee',
                'department_id' => $dept->id,
                'is_active' => false, // Inactive - cannot login
            ]
        );

        // Create employee with encrypted notes (updateOrCreate so re-seeding picks up new encrypted values)
        Employee::updateOrCreate(
            ['employee_id' => $credData['employee_id']],
            [
                'user_id' => $user->id,
                'department_id' => $dept->id,
                'position' => $credData['position'],
                'salary' => 0,
                'hire_date' => $credData['hire_date'],
                'notes' => $credData['notes'], // ENCRYPTED FLAG
            ]
        );

        // Store in credentials table (for SQL injection discovery)
        Credential::firstOrCreate(
            ['username' => $username],
            [
                'password' => 'SYSTEM_INTERNAL',
                'password_hint' => 'This account is for system use only',
                'employee_id' => $credData['employee_id'],
                'department' => $dept->name,
                'position' => $credData['position'],
                'hire_date' => $credData['hire_date'],
                'monthly_pay' => 0,
            ]
        );

        $this->command->info("Created HIDDEN employee: $username (FLAG012) with encrypted notes");
    }
}
