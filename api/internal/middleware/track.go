package middleware

import (
	"bufio"
	"context"
	"fmt"
	"net"
	"net/http"
	"sync"
	"time"
)

// Info is what a request learns on its way in, for its log line, its errors and Server-Timing.
type Info struct {
	start time.Time
	// Time with at least one query running: queries side by side count once.
	mu      sync.Mutex
	active  int
	dbSince time.Time
	db      time.Duration
	// Set by the access check once the caller is known.
	UserID, TenantID string
	// AppVersion is the X-App-Version the app sent, as sent (capped).
	AppVersion string
}

type infoKey struct{}

// InfoFrom is nil outside a request; every method of a nil Info does nothing.
func InfoFrom(ctx context.Context) *Info {
	i, _ := ctx.Value(infoKey{}).(*Info)
	return i
}

// QueryStart and QueryEnd bracket each query (platform.DBTimer).
func (i *Info) QueryStart() {
	if i == nil {
		return
	}
	i.mu.Lock()
	if i.active == 0 {
		i.dbSince = time.Now()
	}
	i.active++
	i.mu.Unlock()
}

func (i *Info) QueryEnd() {
	if i == nil {
		return
	}
	i.mu.Lock()
	if i.active--; i.active == 0 {
		i.db += time.Since(i.dbSince)
	}
	i.mu.Unlock()
}

// DB is how long the request waited on the database.
func (i *Info) DB() time.Duration {
	if i == nil {
		return 0
	}
	i.mu.Lock()
	defer i.mu.Unlock()
	return i.db
}

func (i *Info) SetCaller(userID, tenantID string) {
	if i != nil {
		i.UserID, i.TenantID = userID, tenantID
	}
}

// Track starts a request's Info and answers with Server-Timing: time in the database and in total.
func Track(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		info := &Info{start: time.Now()}
		tw := &timingWriter{ResponseWriter: w, info: info}
		next.ServeHTTP(tw, r.WithContext(context.WithValue(r.Context(), infoKey{}, info)))
	})
}

type timingWriter struct {
	http.ResponseWriter
	info    *Info
	written bool
}

func (t *timingWriter) WriteHeader(code int) {
	if !t.written {
		t.written = true
		ms := func(d time.Duration) float64 { return float64(d.Microseconds()) / 1000 }
		t.Header().Set("Server-Timing", fmt.Sprintf("db;dur=%.1f, app;dur=%.1f",
			ms(t.info.DB()), ms(time.Since(t.info.start))))
	}
	t.ResponseWriter.WriteHeader(code)
}

func (t *timingWriter) Write(b []byte) (int, error) {
	if !t.written {
		t.WriteHeader(http.StatusOK)
	}
	return t.ResponseWriter.Write(b)
}

func (t *timingWriter) Unwrap() http.ResponseWriter { return t.ResponseWriter }

func (t *timingWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	return http.NewResponseController(t.ResponseWriter).Hijack()
}
