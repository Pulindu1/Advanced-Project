package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// LoginRateLimiter tracks per-IP login attempts and short-circuits requests
// once the threshold is crossed. It mirrors the in-memory sliding-window
// limiter used in the Node.js challenges.
type LoginRateLimiter struct {
	mu       sync.Mutex
	hits     map[string][]time.Time
	window   time.Duration
	maxHits  int
	lockouts map[string]time.Time
	lockout  time.Duration
}

func NewLoginRateLimiter() *LoginRateLimiter {
	return &LoginRateLimiter{
		hits:     map[string][]time.Time{},
		lockouts: map[string]time.Time{},
		window:   2 * time.Minute,
		maxHits:  5,
		lockout:  5 * time.Minute,
	}
}

// Middleware returns a gin handler that enforces the rate limit on POST login.
// Successful logins should call Reset to clear the per-IP counter.
func (l *LoginRateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method != http.MethodPost {
			c.Next()
			return
		}
		ip := c.ClientIP()
		now := time.Now()
		l.mu.Lock()
		if until, locked := l.lockouts[ip]; locked {
			if now.Before(until) {
				remaining := int(until.Sub(now).Seconds()) + 1
				l.mu.Unlock()
				c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
					"error":         "too many failed attempts",
					"retry_seconds": remaining,
				})
				return
			}
			delete(l.lockouts, ip)
		}
		cutoff := now.Add(-l.window)
		kept := l.hits[ip][:0]
		for _, t := range l.hits[ip] {
			if t.After(cutoff) {
				kept = append(kept, t)
			}
		}
		l.hits[ip] = kept
		l.mu.Unlock()
		c.Next()
	}
}

// Record logs a failed login attempt. Once the per-IP count exceeds maxHits
// within the sliding window, the IP is locked out.
func (l *LoginRateLimiter) Record(ip string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	cutoff := now.Add(-l.window)
	kept := l.hits[ip][:0]
	for _, t := range l.hits[ip] {
		if t.After(cutoff) {
			kept = append(kept, t)
		}
	}
	kept = append(kept, now)
	l.hits[ip] = kept
	if len(kept) > l.maxHits {
		l.lockouts[ip] = now.Add(l.lockout)
	}
}

// Reset clears the counter for an IP. Called on successful login.
func (l *LoginRateLimiter) Reset(ip string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.hits, ip)
	delete(l.lockouts, ip)
}
