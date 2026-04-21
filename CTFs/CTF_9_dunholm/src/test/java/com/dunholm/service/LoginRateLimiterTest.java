package com.dunholm.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

// Verifies the bucket4j-backed login rate limiter honours capacity and
// keeps buckets per-key. This is a boundary/contract test: it does not
// attempt to bypass the limiter, only to confirm it refuses the
// (capacity + 1)th attempt and that two IPs do not share a bucket.
class LoginRateLimiterTest {

    private LoginRateLimiter limiter;

    @BeforeEach
    void setUp() {
        limiter = new LoginRateLimiter();
        ReflectionTestUtils.setField(limiter, "capacity", 3);
        ReflectionTestUtils.setField(limiter, "refillSeconds", 120);
    }

    @Test
    void permits_up_to_capacity_consecutive_attempts() {
        assertTrue(limiter.tryConsume("login:1.2.3.4"));
        assertTrue(limiter.tryConsume("login:1.2.3.4"));
        assertTrue(limiter.tryConsume("login:1.2.3.4"));
    }

    @Test
    void rejects_further_attempts_once_capacity_is_exhausted() {
        for (int i = 0; i < 3; i++) {
            limiter.tryConsume("login:1.2.3.4");
        }
        assertFalse(limiter.tryConsume("login:1.2.3.4"));
    }

    @Test
    void separate_keys_maintain_independent_buckets() {
        for (int i = 0; i < 3; i++) {
            limiter.tryConsume("login:1.2.3.4");
        }
        assertTrue(limiter.tryConsume("login:9.9.9.9"));
    }
}
