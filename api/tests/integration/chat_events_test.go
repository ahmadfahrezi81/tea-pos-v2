//go:build integration

package integration

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/chatevent"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/domain"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/weather"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/tests/testkit"
)

func events(ms []contract.ChatMessage, kind string) []contract.ChatMessage {
	var out []contract.ChatMessage
	for _, m := range ms {
		if m.Event == kind {
			out = append(out, m)
		}
	}
	return out
}

func execT(t *testing.T, pool *pgxpool.Pool, sql string, args ...any) {
	t.Helper()
	if _, err := pool.Exec(context.Background(), sql, args...); err != nil {
		t.Fatal(err)
	}
}

// TestChatDaySummary: each store's day lands in its chat once, against the day before.
func TestChatDaySummary(t *testing.T) {
	pool := testkit.DB(t)
	oneDay(t, pool) // Central's 1 Oct: 4 cups, Rp 34.000
	execT(t, pool, `INSERT INTO public.store_daily_summaries (id, store_id, tenant_id, opened_by, date, closed_at)
		VALUES ('00000000-0000-0000-0d09-00000000000a', $1, $2, $3, '2026-09-30', '2026-09-30 15:00')`,
		storeACentral, tenantA, testkit.SellerA)
	execT(t, pool, `WITH o AS (INSERT INTO public.store_orders (store_id, user_id, total_amount, tenant_id, daily_summary_id)
		VALUES ($1, $2, 16000, $3, '00000000-0000-0000-0d09-00000000000a') RETURNING id)
		INSERT INTO public.store_order_items (order_id, product_id, quantity, unit_price, total_price, tenant_id)
		SELECT id, $4, 2, 8000, 16000, $3 FROM o`, storeACentral, testkit.SellerA, tenantA, teaA)
	giveChat(t, pool, testkit.SellerA, "member")

	p := chatevent.Poster{Pool: pool}
	day := time.Date(2026, 10, 1, 23, 30, 0, 0, domain.WIB)
	for range 2 {
		if err := p.DaySummaries(context.Background(), day); err != nil {
			t.Fatal(err)
		}
	}
	a := testkit.NewAPI(t, pool, "")
	got := events(messages(t, a, testkit.SellerA, "seller", channelOf(t, a, testkit.SellerA, "seller", "store", "A Central"), ""), chatevent.DaySummary)
	if len(got) != 1 {
		t.Fatalf("Central's summaries: %d, want 1", len(got))
	}
	want := "📊 Today: 4 cups · Rp 34.000 · +2 cups on yesterday · 100% above the 7-day average"
	if got[0].Body != want || got[0].Data["cups"] != float64(4) || got[0].Link == nil || got[0].Link.Kind != chatevent.LinkDay {
		t.Errorf("Central: %q %+v", got[0].Body, got[0])
	}
	if n := count(t, pool, `SELECT count(*) FROM chat_messages m JOIN chat_channels c ON c.id = m.channel_id
		WHERE m.event_type = 'day_summary' AND c.tenant_id = $1`, tenantA); n != 2 {
		t.Errorf("Tenant A's summaries: %d, want 2 (Central and North)", n)
	}
}

// TestChatPayoutPaid: paying someone tells them in their Notifications and VIP, nobody else.
func TestChatPayoutPaid(t *testing.T) {
	pool := testkit.DB(t)
	execT(t, pool, `INSERT INTO payroll_payouts (id, tenant_id, user_id, start_date, end_date) VALUES
		('00000000-0000-0000-9b01-00000000000a', $1, $2, '2026-09-28', '2026-10-11')`, tenantA, testkit.SellerA)
	execT(t, pool, `INSERT INTO payroll_claims (tenant_id, user_id, amount, date, status, payout_id) VALUES
		($1, $2, 15000, '2026-10-01', 'approved', '00000000-0000-0000-9b01-00000000000a')`, tenantA, testkit.SellerA)
	giveChat(t, pool, testkit.SellerA, "member")
	giveChat(t, pool, testkit.GuestA, "member")
	giveChat(t, pool, testkit.AdminA, "admin")
	a := testkit.NewAPI(t, pool, "")
	resp := send(t, a, testkit.AdminA, "backoffice", http.MethodPost, "/tenants/tenant-a/pay/payouts/00000000-0000-0000-9b01-00000000000a/settle",
		`{"status":"paid","paymentProofUrl":"https://supabase.test/storage/v1/object/public/payroll-proofs/`+tenantA+`/1-abc.webp"}`)
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("settle: %d %q", resp.StatusCode, code(t, resp))
	}

	mine := events(messages(t, a, testkit.SellerA, "seller", channelOf(t, a, testkit.SellerA, "seller", "personal", ""), ""), chatevent.PayoutPaid)
	if len(mine) != 1 || mine[0].Body != "💰 Your pay for 28 Sep–11 Oct was paid: Rp 15.000" {
		t.Fatalf("Seller A's Notifications: %+v", mine)
	}
	vip := events(messages(t, a, testkit.AdminA, "backoffice", channelOf(t, a, testkit.AdminA, "backoffice", "admin", ""), ""), chatevent.PayoutPaid)
	if len(vip) != 1 || vip[0].Body != "💰 Admin A paid Seller A Rp 15.000 for 28 Sep–11 Oct" || vip[0].Link == nil || vip[0].Link.Kind != chatevent.LinkPayout {
		t.Fatalf("VIP: %+v", vip)
	}
	for _, c := range chatChannels(t, a, testkit.GuestA, "backoffice") {
		if c.Last != nil && c.Last.Event == chatevent.PayoutPaid {
			t.Errorf("Guest A sees the payout in %s", c.Kind)
		}
	}
}

// TestChatPayTotal: the morning after a period ends, its total goes to VIP once; a member
// does not see it.
func TestChatPayTotal(t *testing.T) {
	pool := testkit.DB(t)
	execT(t, pool, `INSERT INTO payroll_payouts (id, tenant_id, user_id, start_date, end_date) VALUES
		('00000000-0000-0000-9b01-00000000000a', $1, $2, '2026-09-28', '2026-10-11'),
		('00000000-0000-0000-9b02-00000000000a', $1, $3, '2026-09-28', '2026-10-11')`, tenantA, testkit.SellerA, testkit.DriverA)
	execT(t, pool, `INSERT INTO payroll_claims (tenant_id, user_id, amount, date, status, payout_id) VALUES
		($1, $2, 15000, '2026-10-01', 'approved', '00000000-0000-0000-9b01-00000000000a'),
		($1, $3, 5000, '2026-10-01', 'approved', '00000000-0000-0000-9b02-00000000000a')`, tenantA, testkit.SellerA, testkit.DriverA)
	giveChat(t, pool, testkit.SellerA, "member")
	giveChat(t, pool, testkit.AdminA, "vip")

	p := chatevent.Poster{Pool: pool}
	ctx := context.Background()
	for _, at := range []time.Time{
		time.Date(2026, 10, 11, 8, 0, 0, 0, domain.WIB), // the period's last day: not yet
		time.Date(2026, 10, 12, 8, 0, 0, 0, domain.WIB),
		time.Date(2026, 10, 12, 8, 0, 0, 0, domain.WIB), // run twice
	} {
		if err := p.PayTotals(ctx, at); err != nil {
			t.Fatal(err)
		}
	}
	a := testkit.NewAPI(t, pool, "")
	got := events(messages(t, a, testkit.AdminA, "backoffice", channelOf(t, a, testkit.AdminA, "backoffice", "admin", ""), ""), chatevent.PayTotal)
	if len(got) != 1 || got[0].Body != "💼 Pay for 28 Sep–11 Oct: Rp 20.000 for 2 people" {
		t.Fatalf("VIP: %+v", got)
	}
	if got[0].Link == nil || got[0].Link.Kind != chatevent.LinkPayPeriod || got[0].Link.ID != "2026-09-28" {
		t.Errorf("link: %+v", got[0].Link)
	}
	for _, c := range chatChannels(t, a, testkit.SellerA, "seller") {
		if c.Kind == "admin" {
			t.Error("a member sees VIP")
		}
	}
}

// TestChatRain: rain coming is said once, and its end once, only while the store is open.
func TestChatRain(t *testing.T) {
	pool := testkit.DB(t)
	ctx := context.Background()
	execT(t, pool, `INSERT INTO public.store_daily_summaries (store_id, tenant_id, opened_by, date) VALUES ($1, $2, $3, '2026-10-01')`,
		storeACentral, tenantA, testkit.SellerA)
	rain := func(chance int) {
		t.Helper()
		execT(t, pool, `INSERT INTO weather_hours (cell, date, hour, temperature, precipitation_probability, weather_code)
			SELECT $1, '2026-10-01', h, 27, $2, 1000 FROM generate_series(10, 13) h
			ON CONFLICT (cell, date, hour) DO UPDATE SET precipitation_probability = EXCLUDED.precipitation_probability`,
			weather.V1Cell(), chance)
	}
	p := chatevent.Poster{Pool: pool}
	at := time.Date(2026, 10, 1, 10, 20, 0, 0, domain.WIB)
	for _, chance := range []int{10, 70, 80, 15, 5} {
		rain(chance)
		if err := p.Rain(ctx, at); err != nil {
			t.Fatal(err)
		}
	}
	var said []string
	rows, err := pool.Query(ctx, `SELECT m.event_type FROM chat_messages m JOIN chat_channels c ON c.id = m.channel_id
		WHERE c.store_id = $1 ORDER BY m.created_at`, storeACentral)
	if err != nil {
		t.Fatal(err)
	}
	for rows.Next() {
		var e string
		if err := rows.Scan(&e); err != nil {
			t.Fatal(err)
		}
		said = append(said, e)
	}
	if len(said) != 2 || said[0] != chatevent.RainStarted || said[1] != chatevent.RainStopped {
		t.Errorf("Central: %v, want started then stopped", said)
	}
	if n := count(t, pool, `SELECT count(*) FROM chat_messages m JOIN chat_channels c ON c.id = m.channel_id WHERE c.store_id = $1`, storeANorth); n != 0 {
		t.Errorf("North (not open): %d messages", n)
	}
}

// TestChatRelease: the newest version is linked in General once, only where chat is used.
func TestChatRelease(t *testing.T) {
	pool := testkit.DB(t)
	giveChat(t, pool, testkit.SellerA, "member")
	a := testkit.NewAPI(t, pool, "")
	general := channelOf(t, a, testkit.SellerA, "seller", "general", "")
	p := chatevent.Poster{Pool: pool, WhatsNew: []byte(`[{"version":"2026.11.3","apps":["backoffice"]},{"version":"2026.11.2","apps":["seller"]}]`)}
	for range 2 {
		if err := p.Releases(context.Background()); err != nil {
			t.Fatal(err)
		}
	}
	got := events(messages(t, a, testkit.SellerA, "seller", general, ""), chatevent.Release)
	if len(got) != 1 || got[0].Body != "🎉 What's new in 2026.11.3" || got[0].Link == nil || got[0].Link.ID != "2026.11.3" {
		t.Fatalf("General: %+v", got)
	}
	if n := count(t, pool, `SELECT count(*) FROM chat_channels WHERE tenant_id <> $1`, tenantA); n != 0 {
		t.Errorf("channels made in tenants without chat: %d", n)
	}
}

// TestChatShareLink: a backoffice screen shared into a chat opens there; a screen of another
// tenant is refused; the seller app gets a plain chip.
func TestChatShareLink(t *testing.T) {
	pool := testkit.DB(t)
	oneDay(t, pool)
	giveChat(t, pool, testkit.SellerA, "member")
	giveChat(t, pool, testkit.AdminA, "admin")
	a := testkit.NewAPI(t, pool, "")
	general := channelOf(t, a, testkit.AdminA, "backoffice", "general", "")
	share := func(user, app, kind, id string) *http.Response {
		return send(t, a, user, app, http.MethodPost, "/tenants/tenant-a/chat/channels/"+general+"/messages",
			`{"body":"","link":{"kind":"`+kind+`","id":"`+id+`"}}`)
	}
	if resp := share(testkit.AdminA, "backoffice", "day", dayB); code(t, resp) != "link_not_found" {
		t.Errorf("another tenant's day: %d", resp.StatusCode)
	}
	if resp := share(testkit.SellerA, "seller", "day", dayCentral); code(t, resp) != "link_not_found" {
		t.Errorf("shared from the seller app: %d", resp.StatusCode)
	}
	if resp := share(testkit.AdminA, "backoffice", "day", dayCentral); resp.StatusCode != http.StatusOK {
		t.Fatalf("share: %d %q", resp.StatusCode, code(t, resp))
	}
	if resp := share(testkit.AdminA, "backoffice", "pay_period", "2026-10-05"); resp.StatusCode != http.StatusOK {
		t.Fatalf("share a period: %d %q", resp.StatusCode, code(t, resp))
	}
	got := messages(t, a, testkit.AdminA, "backoffice", general, "")
	if len(got) != 2 || got[1].Link == nil || !got[1].Link.Open || got[1].Link.Store != "A Central" || got[1].Link.Cups == nil || *got[1].Link.Cups != 4 {
		t.Fatalf("in the backoffice: %+v", got)
	}
	// A period by any of its days is stored by its first.
	if got[0].Link == nil || got[0].Link.ID != "2026-09-28" || got[0].Link.End != "2026-10-11" {
		t.Errorf("period: %+v", got[0].Link)
	}
	seller := messages(t, a, testkit.SellerA, "seller", general, "")
	if len(seller) != 2 || seller[1].Link == nil || seller[1].Link.Open || seller[1].Link.Store != "" {
		t.Errorf("in the seller app: %+v", seller[1].Link)
	}
}
