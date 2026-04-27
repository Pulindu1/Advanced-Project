<?php

namespace Tests\Integration;

use App\Models\Flag;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class AuthFlowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        RateLimiter::clear('login_127.0.0.1_abcd12');
        RateLimiter::clear('login_127.0.0.1_efgh34');
    }

    /** @test */
    public function login_then_me_then_flag_returns_per_user_flag_across_three_routes(): void
    {
        $user = User::create([
            'username' => 'abcd12',
            'email' => 'abcd12@example.com',
            'password' => Hash::make('correct-password'),
            'first_name' => 'Alice',
            'last_name' => 'Tester',
            'role' => 'employee',
            'is_active' => true,
        ]);

        Flag::create(['username' => 'abcd12', 'flag_value' => 'durham{int-flag-abcd12}']);

        $login = $this->postJson('/api/auth/login', [
            'username' => 'abcd12',
            'password' => 'correct-password',
        ]);
        $login->assertStatus(200);
        $token = $login->json('token');
        $this->assertNotEmpty($token);

        $me = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/auth/me');
        $me->assertStatus(200);
        $me->assertJsonPath('user.username', 'abcd12');

        $flag = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/flag');
        $flag->assertStatus(200);
        $flag->assertJson(['flag' => 'durham{int-flag-abcd12}']);
    }

    /** @test */
    public function each_logged_in_user_only_sees_their_own_flag_across_routes(): void
    {
        User::create([
            'username' => 'abcd12',
            'email' => 'abcd12@example.com',
            'password' => Hash::make('alice-pw'),
            'first_name' => 'A', 'last_name' => 'L',
            'role' => 'employee', 'is_active' => true,
        ]);
        User::create([
            'username' => 'efgh34',
            'email' => 'efgh34@example.com',
            'password' => Hash::make('bob-pw'),
            'first_name' => 'B', 'last_name' => 'R',
            'role' => 'employee', 'is_active' => true,
        ]);
        Flag::create(['username' => 'abcd12', 'flag_value' => 'durham{alice}']);
        Flag::create(['username' => 'efgh34', 'flag_value' => 'durham{bob}']);

        $aliceLogin = $this->postJson('/api/auth/login', [
            'username' => 'abcd12', 'password' => 'alice-pw',
        ]);
        $aliceFlag = $this->withHeader('Authorization', 'Bearer ' . $aliceLogin->json('token'))
            ->getJson('/api/flag');
        $aliceFlag->assertJson(['flag' => 'durham{alice}']);

        $bobLogin = $this->postJson('/api/auth/login', [
            'username' => 'efgh34', 'password' => 'bob-pw',
        ]);
        $bobFlag = $this->withHeader('Authorization', 'Bearer ' . $bobLogin->json('token'))
            ->getJson('/api/flag');
        $bobFlag->assertJson(['flag' => 'durham{bob}']);
    }
}
