package auth

import (
	"sync"
	"time"
)

// Limiter allows n calls per window per key, in memory (one API instance; no Redis).
type Limiter struct {
	n      int
	window time.Duration
	mu     sync.Mutex
	counts map[string]*count
}

type count struct {
	calls int
	since time.Time
}

func NewLimiter(n int, window time.Duration) *Limiter {
	return &Limiter{n: n, window: window, counts: map[string]*count{}}
}

func (l *Limiter) Allow(key string) bool {
	now := time.Now()
	l.mu.Lock()
	defer l.mu.Unlock()
	c := l.counts[key]
	if c == nil || now.Sub(c.since) >= l.window {
		// Bounded: past 10,000 recent callers the map starts over.
		if len(l.counts) > 10_000 {
			clear(l.counts)
		}
		c = &count{since: now}
		l.counts[key] = c
	}
	c.calls++
	return c.calls <= l.n
}
