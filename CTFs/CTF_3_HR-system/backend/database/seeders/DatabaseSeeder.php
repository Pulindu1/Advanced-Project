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
            $this->command->error('  node chgen_ctf3.js abcd12 efgh34 ijkl56');
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
            $this->command->error('credentials.json not found! Run the challenge generator first:');
            $this->command->error('  cd CTFs/challenge-generation');
            $this->command->error('  node chgen_ctf3.js abcd12 efgh34 ijkl56');
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
        foreach ($flags as $username => $flagData) {
            // Validate username format (4 letters + 2 numbers)
            if (!preg_match('/^[a-z]{4}[0-9]{2}$/', $username)) {
                $this->command->warn("Skipping invalid username: $username");
                continue;
            }

            if (!isset($credentials[$username])) {
                $this->command->warn("No credentials found for $username, skipping");
                continue;
            }

            $credData = $credentials[$username];
            $userPassword = is_string($credData) ? $credData : $credData['password'];

            // Support both nested format { flag_api, flag_decrypt } and flat string
            $flagApiValue = is_array($flagData) ? $flagData['flag_api'] : $flagData;

            // Determine employee details
            if (is_array($credData) && isset($credData['employee_id'])) {
                $employeeId = $credData['employee_id'];
                $credDeptName = $credData['department'];
                $position = $credData['position'];
                $hireDate = $credData['hire_date'];
                $monthlyPay = $credData['monthly_pay'] ?? rand(4000, 10000);

                $dept = collect($departments)->first(fn($d) => $d->name === $credDeptName);
                if (!$dept) {
                    $this->command->warn("Department '$credDeptName' not found for $username, using random");
                    $dept = $departments[array_rand($departments)];
                }
            } else {
                $employeeId = 'EMP' . str_pad(array_search($username, array_keys($credentials)) + 1, 3, '0', STR_PAD_LEFT);
                $dept = $departments[array_rand($departments)];
                $position = $positions[array_rand($positions)];
                $hireDate = now()->subMonths(rand(1, 36))->format('Y-m-d');
                $monthlyPay = rand(4000, 10000);
            }

            // Create user (idempotent)
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

            // Store the API flag for this user
            Flag::firstOrCreate(
                ['username' => $username],
                ['flag_value' => $flagApiValue]
            );

            // Store credentials in vulnerable table (PLAINTEXT - for SQL injection challenge)
            Credential::firstOrCreate(
                ['username' => $username],
                [
                    'password' => $userPassword,
                    'password_hint' => 'Contact HR if you forgot your password',
                    'employee_id' => $employeeId,
                    'department' => $dept->name,
                    'position' => $position,
                    'hire_date' => $hireDate,
                    'monthly_pay' => $monthlyPay,
                ]
            );

            $this->command->info("Created player: $username (password: $userPassword, dept: {$dept->name})");

            // Create the per-user bot employee (hidden, contains encrypted flag)
            $botUsername = $username . '-bot';
            if (isset($credentials[$botUsername])) {
                $this->createBotEmployee($botUsername, $credentials[$botUsername], $departments);
            }
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
        $this->command->info('CTF SETUP: Per-user bot employees created (hidden from normal queries, discoverable via SQLi)');
    }

    /**
     * Create a hidden bot employee for a player's encrypted flag.
     */
    private function createBotEmployee(string $botUsername, array $credData, array $departments): void
    {
        $dept = collect($departments)->first(fn($d) => $d->name === ($credData['department'] ?? 'Operations'));
        if (!$dept) {
            $dept = $departments[0];
        }

        // Create user (inactive - cannot login)
        $user = User::firstOrCreate(
            ['username' => $botUsername],
            [
                'email' => $botUsername . '@system.internal',
                'password' => Hash::make('SYSTEM_INTERNAL_DO_NOT_USE'),
                'first_name' => 'System',
                'last_name' => 'Bot',
                'role' => 'employee',
                'department_id' => $dept->id,
                'is_active' => false,
            ]
        );

        // Create employee with encrypted notes (updateOrCreate so re-seeding picks up new encrypted values)
        Employee::updateOrCreate(
            ['employee_id' => $credData['employee_id']],
            [
                'user_id' => $user->id,
                'department_id' => $dept->id,
                'position' => $credData['position'] ?? 'System Account',
                'salary' => 0,
                'hire_date' => $credData['hire_date'] ?? '2024-01-01',
                'notes' => $credData['notes'],
            ]
        );

        // Store in credentials table (for debug endpoint discovery)
        Credential::firstOrCreate(
            ['username' => $botUsername],
            [
                'password' => 'SYSTEM_INTERNAL',
                'password_hint' => 'This account is for system use only',
                'employee_id' => $credData['employee_id'],
                'department' => $dept->name,
                'position' => $credData['position'] ?? 'System Account',
                'hire_date' => $credData['hire_date'] ?? '2024-01-01',
                'monthly_pay' => 0,
            ]
        );

        $owner = $credData['owner'] ?? '?';
        $this->command->info("Created bot employee: $botUsername ({$credData['employee_id']}) for player $owner");
    }
}
