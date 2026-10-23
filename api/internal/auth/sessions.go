package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"net/http"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
)

const (
	// Lifetime of a session, renewed while it is used.
	Lifetime = 30 * 24 * time.Hour
	// renewAfter keeps renewal to one write a day per session.
	renewAfter = 24 * time.Hour
	// cacheTTL is how long a looked-up session is trusted without the database;
	// a revoked session or a role change applies within it.
	cacheTTL = time.Minute

	CookieName = "session"
)

var ErrNoSession = errors.New("no session")

type Session struct {
	ID     pgtype.UUID
	UserID pgtype.UUID
	App    string
	Role   string
	Status string
}

type cached struct {
	session Session
	until   time.Time
}

type Sessions struct {
	q     *store.Queries
	mu    sync.Mutex
	cache map[[32]byte]cached
}

func NewSessions(q *store.Queries) *Sessions {
	return &Sessions{q: q, cache: map[[32]byte]cached{}}
}

// Create starts a session and returns the token for the cookie; only its hash is stored.
func (s *Sessions) Create(ctx context.Context, userID pgtype.UUID, app, ip, userAgent string) (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	token := base64.RawURLEncoding.EncodeToString(raw)
	hash := sha256.Sum256([]byte(token))
	err := s.q.CreateSession(ctx, store.CreateSessionParams{
		TokenHash: hash[:],
		UserID:    userID,
		App:       app,
		ExpiresAt: pgtype.Timestamptz{Time: time.Now().Add(Lifetime), Valid: true},
		Ip:        pgtype.Text{String: ip, Valid: ip != ""},
		UserAgent: pgtype.Text{String: userAgent, Valid: userAgent != ""},
	})
	return token, err
}

// Lookup returns the token's session. renewed is true when its expiry moved, so the cookie should too.
func (s *Sessions) Lookup(ctx context.Context, token string) (_ Session, renewed bool, _ error) {
	hash := sha256.Sum256([]byte(token))
	s.mu.Lock()
	hit, ok := s.cache[hash]
	s.mu.Unlock()
	if ok && time.Now().Before(hit.until) {
		return hit.session, false, nil
	}

	row, err := s.q.GetSession(ctx, hash[:])
	if errors.Is(err, pgx.ErrNoRows) {
		return Session{}, false, ErrNoSession
	}
	if err != nil {
		return Session{}, false, err
	}
	session := Session{ID: row.ID, UserID: row.UserID, App: row.App, Role: row.Role, Status: row.Status}
	if time.Since(row.LastSeenAt.Time) > renewAfter {
		err := s.q.RenewSession(ctx, store.RenewSessionParams{
			ID:        row.ID,
			ExpiresAt: pgtype.Timestamptz{Time: time.Now().Add(Lifetime), Valid: true},
		})
		if err != nil {
			return Session{}, false, err
		}
		renewed = true
	}

	s.mu.Lock()
	// Bounded: past 10,000 cached sessions it starts over (they are re-read within a minute anyway).
	if len(s.cache) > 10_000 {
		clear(s.cache)
	}
	s.cache[hash] = cached{session: session, until: time.Now().Add(cacheTTL)}
	s.mu.Unlock()
	return session, renewed, nil
}

func (s *Sessions) Delete(ctx context.Context, token string) error {
	hash := sha256.Sum256([]byte(token))
	s.mu.Lock()
	delete(s.cache, hash)
	s.mu.Unlock()
	return s.q.DeleteSession(ctx, hash[:])
}

// Cookie is the session cookie: on the app's own address only, unreadable by JavaScript.
// maxAge 0 clears it.
func Cookie(token string, maxAge time.Duration, secure bool) http.Cookie {
	c := http.Cookie{
		Name:     CookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(maxAge.Seconds()),
	}
	if maxAge == 0 {
		c.MaxAge = -1
	}
	return c
}
