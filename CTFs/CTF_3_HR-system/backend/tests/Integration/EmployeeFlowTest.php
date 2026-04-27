<?php

namespace Tests\Integration;

use App\Models\Department;
use App\Models\Employee;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class EmployeeFlowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        RateLimiter::clear('login_127.0.0.1_abcd12');
    }

    private function seedUserAndEmployee(string $username, string $role = 'employee'): User
    {
        $user = User::create([
            'username' => $username,
            'email' => $username . '@example.com',
            'password' => Hash::make('pwd'),
            'first_name' => ucfirst($username),
            'last_name' => 'Test',
            'role' => $role,
            'is_active' => true,
        ]);

        $dept = Department::firstOrCreate(
            ['code' => 'ENG'],
            ['name' => 'Engineering']
        );

        Employee::create([
            'user_id' => $user->id,
            'department_id' => $dept->id,
            'employee_id' => 'EMP-' . strtoupper($username),
            'position' => 'Engineer',
            'hire_date' => now()->toDateString(),
            'salary' => 50000,
            'notes' => 'integration-test',
        ]);

        return $user;
    }

    /** @test */
    public function login_then_employee_list_then_show_returns_seeded_record(): void
    {
        $user = $this->seedUserAndEmployee('abcd12');

        $login = $this->postJson('/api/auth/login', [
            'username' => 'abcd12', 'password' => 'pwd',
        ]);
        $token = $login->json('token');

        $list = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/employees');
        $list->assertStatus(200);
        $rows = $list->json('data');
        $this->assertNotEmpty($rows);
        $abcd = collect($rows)->firstWhere('employee_id', 'EMP-ABCD12');
        $this->assertNotNull($abcd);
        $employeePk = $abcd['id'];

        $detail = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/employees/' . $employeePk);
        $detail->assertStatus(200);
        $detail->assertJsonPath('employee.position', 'Engineer');
    }

    /** @test */
    public function unauthenticated_employee_list_is_rejected_then_authed_succeeds(): void
    {
        $this->seedUserAndEmployee('abcd12');

        $unauth = $this->getJson('/api/employees');
        $unauth->assertStatus(401);

        $login = $this->postJson('/api/auth/login', [
            'username' => 'abcd12', 'password' => 'pwd',
        ]);
        $authed = $this->withHeader('Authorization', 'Bearer ' . $login->json('token'))
            ->getJson('/api/employees');
        $authed->assertStatus(200);
    }
}
