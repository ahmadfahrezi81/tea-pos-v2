//go:build integration

package integration

import (
	"context"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/page"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/tests/testkit"
)

// Paging a list while rows are added returns every row that was there exactly once; since
// returns only the newer ones. Same SQL shape as page's doc, on a throwaway table.
func TestPaging(t *testing.T) {
	pool := testkit.DB(t)
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `CREATE TABLE items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL)`); err != nil {
		t.Fatal(err)
	}
	base := time.Date(2026, 10, 24, 8, 0, 0, 0, time.UTC)
	// 95 rows, some sharing a time (the id breaks the tie).
	for i := range 95 {
		if _, err := pool.Exec(ctx, `INSERT INTO items (created_at) VALUES ($1)`, base.Add(time.Duration(i/3)*time.Minute)); err != nil {
			t.Fatal(err)
		}
	}
	type row struct {
		ID pgtype.UUID
		At time.Time
	}
	fetch := func(c page.Cursor, limit int) page.Output[row] {
		rs, err := pool.Query(ctx, `SELECT id, created_at FROM items WHERE (created_at, id) < ($1, $2) ORDER BY created_at DESC, id DESC LIMIT $3`, c.At, c.ID, limit+1)
		if err != nil {
			t.Fatal(err)
		}
		defer rs.Close()
		var out []row
		for rs.Next() {
			var r row
			if err := rs.Scan(&r.ID, &r.At); err != nil {
				t.Fatal(err)
			}
			out = append(out, r)
		}
		return page.Rows(out, limit, func(r row) page.Cursor { return page.Cursor{At: r.At, ID: r.ID} })
	}

	seen := map[string]int{}
	cursor := ""
	for pages := 0; ; pages++ {
		c, err := page.Decode(cursor)
		if err != nil {
			t.Fatal(err)
		}
		p := fetch(c, 20)
		for _, r := range p.Items {
			seen[r.ID.String()]++
		}
		// Rows arriving while the user scrolls are newer: they never shift the pages below.
		if _, err := pool.Exec(ctx, `INSERT INTO items (created_at) VALUES ($1)`, base.Add(time.Hour+time.Duration(pages)*time.Minute)); err != nil {
			t.Fatal(err)
		}
		if p.Next == "" {
			break
		}
		cursor = p.Next
	}
	if len(seen) != 95 {
		t.Fatalf("%d rows seen, want 95", len(seen))
	}
	for id, n := range seen {
		if n != 1 {
			t.Fatalf("%s seen %d times", id, n)
		}
	}
	if n := count(t, pool, `SELECT count(*) FROM items WHERE created_at > $1`, base.Add(time.Hour-time.Second)); n != 5 {
		t.Fatalf("since: %d newer rows, want the 5 added while paging", n)
	}
	if _, err := page.Decode("not a cursor"); err == nil {
		t.Fatal("a made-up cursor decoded")
	}
}
