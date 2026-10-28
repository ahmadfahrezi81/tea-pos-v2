// Command fakesales gives staging's open stores a day of sales, so the backoffice has something to
// show. Open the stores in v1's staging seller app first: this only adds orders, the way v1's
// createOrder writes them (the order, its items, the day's totals), to stores open today, by the
// seller on shift. It tops each store up to -orders, so running it twice adds nothing.
// Refuses anything but staging.
//
//	cd api && infisical run --env=staging --path=/app -- go run ./tools/fakesales
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"math/rand/v2"
	"os"
	"slices"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/domain"
)

type store struct {
	id, tenantID, name  string
	summaryID, sellerID string
	started             time.Time
	orders              int
}

type product struct {
	id    string
	price int
}

func main() {
	target := flag.Int("orders", 40, "orders each open store should have today")
	tenant := flag.String("tenant", "", "only this tenant's slug (default: every tenant)")
	flag.Parse()
	if err := run(context.Background(), *target, *tenant); err != nil {
		fmt.Fprintln(os.Stderr, "fakesales:", err)
		os.Exit(1)
	}
}

func run(ctx context.Context, target int, tenant string) error {
	if env := os.Getenv("ENV"); env != "staging" {
		return fmt.Errorf("refusing ENV=%q: staging only", env)
	}
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		return errors.New("DATABASE_URL is required")
	}
	db, err := pgxpool.New(ctx, url)
	if err != nil {
		return err
	}
	defer db.Close()

	today := time.Now().In(domain.WIB).Format(time.DateOnly)
	rows, err := db.Query(ctx, `
		SELECT s.id, s.tenant_id, s.name, coalesce(ss.daily_summary_id::text, ''), coalesce(ss.user_id::text, ''),
		       coalesce(ss.started_at, now()),
		       (SELECT count(*) FROM store_orders o WHERE o.daily_summary_id = ss.daily_summary_id)
		FROM stores s
		JOIN tenants t ON t.id = s.tenant_id
		LEFT JOIN store_sessions ss ON ss.store_id = s.id AND ss.status = 'active'
		LEFT JOIN store_daily_summaries d ON d.id = ss.daily_summary_id
		WHERE s.status IN ('active', 'fake') AND ($1 = '' OR t.slug = $1)
		  AND (ss.id IS NULL OR (d.date = $2::date AND d.closed_at IS NULL))
		ORDER BY t.slug, s.name`, tenant, today)
	if err != nil {
		return err
	}
	stores, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (store, error) {
		var s store
		return s, r.Scan(&s.id, &s.tenantID, &s.name, &s.summaryID, &s.sellerID, &s.started, &s.orders)
	})
	if err != nil {
		return err
	}

	var closed []string
	for _, s := range stores {
		if s.summaryID == "" {
			closed = append(closed, s.name)
			continue
		}
		added, err := fill(ctx, db, s, target-s.orders)
		if err != nil {
			return fmt.Errorf("%s: %w", s.name, err)
		}
		fmt.Printf("%-24s %d orders added (%d today)\n", s.name, added, s.orders+added)
	}
	if len(closed) > 0 {
		fmt.Printf("closed, skipped: %v\n", closed)
	}
	return nil
}

// fill adds n orders between the shift's start and now, in one transaction with the day's totals.
func fill(ctx context.Context, db *pgxpool.Pool, s store, n int) (int, error) {
	if n <= 0 {
		return 0, nil
	}
	rows, err := db.Query(ctx, `
		SELECT id, price FROM tenant_products
		WHERE tenant_id = $1 AND is_active AND status = 'active' ORDER BY popularity_rank NULLS LAST, name`, s.tenantID)
	if err != nil {
		return 0, err
	}
	products, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (product, error) {
		var p product
		return p, r.Scan(&p.id, &p.price)
	})
	if err != nil {
		return 0, err
	}
	if len(products) == 0 {
		return 0, errors.New("no active products")
	}

	now := time.Now().UTC()
	span := now.Sub(s.started)
	times := make([]time.Time, n)
	for i := range times {
		times[i] = s.started.Add(time.Duration(rand.Int64N(int64(span) + 1))).UTC()
	}
	slices.SortFunc(times, func(a, b time.Time) int { return a.Compare(b) })

	tx, err := db.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	var sales, cups, cash int
	for _, at := range times {
		method := "cash"
		if rand.IntN(4) == 0 {
			method = "qris"
		}
		var items [][3]int // product index, quantity, price
		for range 1 + rand.IntN(3) {
			// Earlier products sell more, as the popular ones do.
			i := min(rand.IntN(len(products)), rand.IntN(len(products)))
			items = append(items, [3]int{i, 1 + rand.IntN(2), products[i].price})
		}
		total := 0
		for _, it := range items {
			total += it[1] * it[2]
			cups += it[1]
		}

		var orderID string
		// The old tables hold UTC without a zone.
		if err := tx.QueryRow(ctx, `
			INSERT INTO store_orders (store_id, user_id, total_amount, tenant_id, payment_method, daily_summary_id, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
			s.id, s.sellerID, total, s.tenantID, method, s.summaryID, at.Format("2006-01-02 15:04:05.999999")).Scan(&orderID); err != nil {
			return 0, err
		}
		for _, it := range items {
			if _, err := tx.Exec(ctx, `
				INSERT INTO store_order_items (order_id, product_id, quantity, unit_price, total_price, tenant_id, created_at)
				VALUES ($1, $2, $3, $4, $5, $6, $7)`,
				orderID, products[it[0]].id, it[1], it[2], it[1]*it[2], s.tenantID, at.Format("2006-01-02 15:04:05.999999")); err != nil {
				return 0, err
			}
		}
		sales += total
		if method == "cash" {
			cash += total
		}
	}

	if _, err := tx.Exec(ctx, `
		UPDATE store_daily_summaries
		SET total_sales = total_sales + $2, total_orders = total_orders + $3,
		    total_cups = total_cups + $4, expected_cash = expected_cash + $5
		WHERE id = $1`, s.summaryID, sales, n, cups, cash); err != nil {
		return 0, err
	}
	return n, tx.Commit(ctx)
}
