// Package page is how every list pages: newest first by time then id, a page at a time, so a
// page never repeats or skips a row while rows are added in between; and `since`, for a list
// to fetch only what changed after its newest row (told by the realtime hub). Task 017e.
//
// A list's query takes the cursor and one more row than the limit:
//
//	WHERE (created_at, id) < (@cursor_at, @cursor_id)
//	ORDER BY created_at DESC, id DESC
//	LIMIT @limit
//
// with Cursor.At and Cursor.ID (the first page's are "after everything"), and Rows trims the
// extra row into the next page's cursor.
package page

import (
	"encoding/base64"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

// Input is embedded in a list route's input.
type Input struct {
	Cursor string    `query:"cursor" doc:"From the previous page's next; empty for the first"`
	Limit  int       `query:"limit" minimum:"1" maximum:"100" default:"30"`
	Since  time.Time `query:"since" doc:"Only rows changed after this (a list catching up)"`
}

// Output is a list route's body.
type Output[T any] struct {
	Items []T `json:"items" nullable:"false"`
	// Next fetches the following page; empty on the last.
	Next string `json:"next,omitempty"`
}

// Cursor is where a page ends: the last row's time and id.
type Cursor struct {
	At time.Time
	ID pgtype.UUID
}

// Start is "after everything": the first page's cursor.
var Start = Cursor{At: time.Date(9999, 1, 1, 0, 0, 0, 0, time.UTC), ID: pgtype.UUID{Bytes: [16]byte{0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff}, Valid: true}}

var ErrBadCursor = errors.New("bad cursor")

// Decode reads a cursor from a previous page; empty is Start.
func Decode(s string) (Cursor, error) {
	if s == "" {
		return Start, nil
	}
	raw, err := base64.RawURLEncoding.DecodeString(s)
	if err != nil {
		return Cursor{}, ErrBadCursor
	}
	at, id, ok := strings.Cut(string(raw), "|")
	t, err := time.Parse(time.RFC3339Nano, at)
	var u pgtype.UUID
	if !ok || err != nil || u.Scan(id) != nil {
		return Cursor{}, ErrBadCursor
	}
	return Cursor{At: t, ID: u}, nil
}

func (c Cursor) Encode() string {
	return base64.RawURLEncoding.EncodeToString([]byte(c.At.UTC().Format(time.RFC3339Nano) + "|" + c.ID.String()))
}

// Rows turns limit+1 rows into a page: at most limit items, and the next page's cursor when
// there was one more.
func Rows[T any](rows []T, limit int, key func(T) Cursor) Output[T] {
	out := Output[T]{Items: rows}
	if len(rows) > limit {
		out.Items = rows[:limit]
		out.Next = key(rows[limit-1]).Encode()
	}
	if out.Items == nil {
		out.Items = []T{}
	}
	return out
}
