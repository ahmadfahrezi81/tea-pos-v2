// Package idem saves each write exactly once, however many times a phone sends it (a double
// tap, a retry on slow 4G, a resend after a timeout). A write route declared Idempotent()
// runs inside a transaction that also stores its answer under the request's Idempotency-Key;
// the same key again gets that answer without running again, and two at once run once (the
// second waits for the first's transaction). Task 017e.
package idem

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/auth"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/httpx"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
)

const Header = "Idempotency-Key"

// maxBody is Huma's default request limit.
const maxBody = 1 << 20

var (
	errNoKey    = httpx.New(http.StatusBadRequest, "idempotency_key_required", "This write needs an Idempotency-Key")
	errKeyReuse = httpx.New(http.StatusConflict, "idempotency_key_reused", "This key was used for another request")
	errInternal = httpx.New(http.StatusInternalServerError, "internal", "Something went wrong")
	errTooLarge = httpx.New(http.StatusRequestEntityTooLarge, "too_large", "This request is too large")
)

type txKey struct{}

// Queries is q inside the write's transaction on an Idempotent route (its change and its saved
// answer commit together), q itself anywhere else.
func Queries(ctx context.Context, q *store.Queries) *store.Queries {
	if tx, ok := ctx.Value(txKey{}).(pgx.Tx); ok {
		return q.WithTx(tx)
	}
	return q
}

// Tx is the write's transaction on an Idempotent route (to queue a job with it: jobs.Insert).
func Tx(ctx context.Context) (pgx.Tx, bool) {
	tx, ok := ctx.Value(txKey{}).(pgx.Tx)
	return tx, ok
}

// Middleware runs after the access check, on routes whose Access is Idempotent.
func Middleware(pool *pgxpool.Pool) func(huma.Context, func(huma.Context)) {
	return func(ctx huma.Context, next func(huma.Context)) {
		access, _ := auth.AccessOf(ctx.Operation())
		if !access.SavedOnce || pool == nil {
			next(ctx)
			return
		}
		key := ctx.Header(Header)
		if len(key) < 8 || len(key) > 100 {
			write(ctx, errNoKey)
			return
		}
		caller, _ := auth.CallerFrom(ctx.Context())
		// Read here to hash it, so limited here: Huma's own limit applies only after.
		body, err := io.ReadAll(io.LimitReader(ctx.BodyReader(), maxBody+1))
		if err != nil {
			write(ctx, errInternal)
			return
		}
		if len(body) > maxBody {
			write(ctx, errTooLarge)
			return
		}
		sum := sha256.Sum256(append([]byte(ctx.Method()+" "+ctx.URL().Path+"\n"), body...))
		run(ctx, next, pool, caller.UserID, key, sum[:], body)
	}
}

func run(ctx huma.Context, next func(huma.Context), pool *pgxpool.Pool, user pgtype.UUID, key string, hash, body []byte) {
	c := ctx.Context()
	tx, err := pool.Begin(c)
	if err != nil {
		slog.ErrorContext(c, "idempotency: begin", "err", err)
		write(ctx, errInternal)
		return
	}
	defer func() { _ = tx.Rollback(context.WithoutCancel(c)) }()
	q := store.New(pool).WithTx(tx)

	first, err := q.ClaimIdempotencyKey(c, store.ClaimIdempotencyKeyParams{UserID: user, Key: key, RequestHash: hash})
	if err != nil {
		slog.ErrorContext(c, "idempotency: claim", "err", err)
		write(ctx, errInternal)
		return
	}
	if first == 0 {
		replay(ctx, q, user, key, hash)
		return
	}

	held := &capture{inner: huma.WithValue(ctx, txKey{}, tx), body: bytes.NewReader(body), status: http.StatusOK}
	next(held)
	// A failure that may be passing (5xx) is not kept: the next try runs again.
	if held.status >= 500 {
		flush(ctx, held.status, held.out.Bytes())
		return
	}
	err = q.SaveIdempotentAnswer(c, store.SaveIdempotentAnswerParams{
		UserID: user, Key: key,
		Status:      pgtype.Int2{Int16: int16(held.status), Valid: true},
		ContentType: pgtype.Text{String: held.contentType, Valid: held.contentType != ""},
		Body:        held.out.Bytes(),
	})
	if err == nil {
		err = tx.Commit(c)
	}
	if err != nil {
		slog.ErrorContext(c, "idempotency: save", "err", err)
		write(ctx, errInternal)
		return
	}
	flush(ctx, held.status, held.out.Bytes())
}

// replay answers as the first request did; a key reused for another request is refused.
func replay(ctx huma.Context, q *store.Queries, user pgtype.UUID, key string, hash []byte) {
	a, err := q.GetIdempotentAnswer(ctx.Context(), store.GetIdempotentAnswerParams{UserID: user, Key: key})
	if err != nil || !a.Status.Valid {
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			slog.ErrorContext(ctx.Context(), "idempotency: replay", "err", err)
		}
		write(ctx, errInternal)
		return
	}
	if !bytes.Equal(a.RequestHash, hash) {
		write(ctx, errKeyReuse)
		return
	}
	if a.ContentType.Valid {
		ctx.SetHeader("Content-Type", a.ContentType.String)
	}
	ctx.SetHeader("Idempotent-Replayed", "true")
	flush(ctx, int(a.Status.Int16), a.Body)
}

func flush(ctx huma.Context, status int, body []byte) {
	ctx.SetStatus(status)
	if len(body) > 0 {
		_, _ = ctx.BodyWriter().Write(body)
	}
}

func write(ctx huma.Context, e *httpx.Error) {
	ctx.SetHeader("Content-Type", "application/json")
	ctx.SetStatus(e.Status)
	_ = json.NewEncoder(ctx.BodyWriter()).Encode(e)
}

// inner is huma.Context under another name, so embedding it keeps its Context() method.
type inner = huma.Context

// capture holds the handler's answer until its transaction commits.
type capture struct {
	inner
	body        io.Reader
	status      int
	contentType string
	out         bytes.Buffer
}

func (c *capture) BodyReader() io.Reader { return c.body }
func (c *capture) SetStatus(code int)    { c.status = code }
func (c *capture) Status() int           { return c.status }
func (c *capture) BodyWriter() io.Writer { return &c.out }
func (c *capture) SetHeader(name, value string) {
	if http.CanonicalHeaderKey(name) == "Content-Type" {
		c.contentType = value
	}
	c.inner.SetHeader(name, value)
}
