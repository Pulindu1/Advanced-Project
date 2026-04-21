<?php

namespace Tests\Feature;

use App\Models\Flag;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class ContractTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        RateLimiter::clear('login_127.0.0.1_abcd12');
    }

    public function test_t1_login_missing_body_rejects_with_error_message(): void
    {
        $response = $this->postJson('/api/auth/login', []);
        // Controller wraps ValidationException in a generic catch; documents current behaviour
        $this->assertContains($response->status(), [422, 500]);
        $response->assertJsonStructure(['error']);
    }

    public function test_t2_login_invalid_credentials_returns_401(): void
    {
        User::create([
            'username' => 'abcd12',
            'email' => 'abcd12@example.com',
            'password' => Hash::make('correct-password'),
            'first_name' => 'A',
            'last_name' => 'B',
            'role' => 'employee',
            'is_active' => true,
        ]);

        $response = $this->postJson('/api/auth/login', [
            'username' => 'abcd12',
            'password' => 'wrong-password',
        ]);
        $response->assertStatus(401);
        $response->assertJson(['error' => 'Invalid credentials']);
    }

    public function test_t3_login_rate_limits_after_five_failures(): void
    {
        User::create([
            'username' => 'abcd12',
            'email' => 'abcd12@example.com',
            'password' => Hash::make('correct-password'),
            'first_name' => 'A',
            'last_name' => 'B',
            'role' => 'employee',
            'is_active' => true,
        ]);

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/login', [
                'username' => 'abcd12',
                'password' => 'wrong-password',
            ])->assertStatus(401);
        }

        $response = $this->postJson('/api/auth/login', [
            'username' => 'abcd12',
            'password' => 'wrong-password',
        ]);
        $response->assertStatus(429);
        $response->assertJsonStructure(['error', 'retry_after']);
    }

    public function test_t4_me_without_token_returns_401(): void
    {
        $response = $this->getJson('/api/auth/me');
        $response->assertStatus(401);
        $response->assertJson(['error' => 'Token not provided']);
    }

    public function test_t5_flag_endpoint_requires_authentication(): void
    {
        Flag::create(['username' => 'abcd12', 'flag_value' => 'CTF{x}']);
        $response = $this->getJson('/api/flag');
        $response->assertStatus(401);
    }

    public function test_t6_debug_config_missing_user_param_returns_400(): void
    {
        $user = User::create([
            'username' => 'abcd12',
            'email' => 'abcd12@example.com',
            'password' => Hash::make('correct-password'),
            'first_name' => 'A',
            'last_name' => 'B',
            'role' => 'employee',
            'is_active' => true,
        ]);

        $payload = [
            'iss' => config('app.url'),
            'sub' => $user->id,
            'username' => $user->username,
            'role' => $user->role,
            'iat' => time(),
            'exp' => time() + 3600,
        ];
        $token = \Firebase\JWT\JWT::encode($payload, config('jwt.secret'), config('jwt.algo'));

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/debug/config');
        $response->assertStatus(400);
        $response->assertJsonStructure(['error', 'hint']);
    }
}
