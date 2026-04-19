package com.dunholm.service;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class LoginRateLimiter {

    @Value("${app.ratelimit.login.capacity:5}")
    private int capacity;

    @Value("${app.ratelimit.login.refill-seconds:120}")
    private int refillSeconds;

    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    public boolean tryConsume(String key) {
        Bucket b = buckets.computeIfAbsent(key, k -> Bucket.builder()
            .addLimit(Bandwidth.builder()
                .capacity(capacity)
                .refillIntervally(capacity, Duration.ofSeconds(refillSeconds))
                .build())
            .build());
        return b.tryConsume(1);
    }
}
