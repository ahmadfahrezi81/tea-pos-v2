package chatevent

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/domain"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/weather"
)

// RainThreshold: rain is said to be coming when this hour's or the next two's chance reaches it,
// and gone when all three fall below it again.
const RainThreshold = 20

// whatsNew is packages/shell/whats-new.json, copied by `generate` (CI fails on a stale copy).
//
//go:embed whats-new.json
var whatsNew []byte

// Poster posts the worker's events, each in its own transaction.
type Poster struct {
	Pool *pgxpool.Pool
	// Queue for a job's transaction: the worker's own River client, from the job's context.
	Queue func(ctx context.Context) Queue
	// WhatsNew overrides the embedded What's new (tests).
	WhatsNew []byte
}

func (p Poster) post(ctx context.Context, e Event) (bool, error) {
	var posted bool
	err := pgx.BeginFunc(ctx, p.Pool, func(tx pgx.Tx) error {
		var err error
		var queue Queue
		if p.Queue != nil {
			queue = p.Queue(ctx)
		}
		posted, err = Post(ctx, tx, queue, e)
		return err
	})
	return posted, err
}

func date(t time.Time) pgtype.Date {
	return pgtype.Date{Time: time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC), Valid: true}
}

// DaySummaries posts each store's day on day (WIB): cups and sales, against the day before and
// the 7 days before it. Once per day, however often it runs.
func (p Poster) DaySummaries(ctx context.Context, day time.Time) error {
	q := store.New(p.Pool)
	rows, err := q.StoreDayTotals(ctx, store.StoreDayTotalsParams{FromDate: date(day.AddDate(0, 0, -7)), ToDate: date(day)})
	if err != nil {
		return err
	}
	today := day.Format(time.DateOnly)
	byStore := map[pgtype.UUID][]store.StoreDayTotalsRow{}
	for _, r := range rows {
		byStore[r.StoreID] = append(byStore[r.StoreID], r)
	}
	posted := 0
	for _, days := range byStore {
		var this *store.StoreDayTotalsRow
		var prev any
		var sum, n int64
		for i, r := range days {
			switch d := r.Date.Time.Format(time.DateOnly); {
			case d == today:
				this = &days[i]
			default:
				sum += r.Cups
				n++
				if d == day.AddDate(0, 0, -1).Format(time.DateOnly) {
					prev = r.Cups
				}
			}
		}
		if this == nil {
			continue
		}
		data := map[string]any{
			"dayId": this.ID.String(), "storeId": this.StoreID.String(), "date": today,
			"link": Link{Kind: LinkDay, ID: this.ID.String()},
			"cups": this.Cups, "sales": this.Sales, "prevCups": prev,
		}
		if n > 0 {
			data["avgCups"] = float64(sum) / float64(n)
		}
		ok, err := p.post(ctx, Event{Tenant: this.TenantID, Where: Store(this.StoreID), Type: DaySummary, Data: data, Key: "day:" + today})
		if err != nil {
			return fmt.Errorf("day summary %s: %w", this.ID, err)
		}
		if ok {
			posted++
		}
	}
	slog.InfoContext(ctx, "day summaries", "posted", posted)
	return nil
}

// PayTotals posts, the morning after a pay period ends, what it owes in all to VIP.
func (p Poster) PayTotals(ctx context.Context, now time.Time) error {
	q := store.New(p.Pool)
	yesterday := now.In(domain.WIB).AddDate(0, 0, -1)
	tenants, err := q.ListPayTenants(ctx)
	if err != nil {
		return err
	}
	for _, t := range tenants {
		start, end, err := domain.PayWindow(yesterday, t.PayFrequency)
		if err != nil {
			return err
		}
		if end.Format(time.DateOnly) != yesterday.Format(time.DateOnly) {
			continue
		}
		// As the period's Pay page adds it up: everyone it pays, paid yet or not.
		rows, err := q.ListPayouts(ctx, store.ListPayoutsParams{TenantID: t.ID, FromDate: date(start), ToDate: date(end)})
		if err != nil {
			return err
		}
		var total, people int64
		for _, r := range rows {
			if r.Commissions+r.Claims > 0 {
				total += r.Commissions + r.Claims
				people++
			}
		}
		if people == 0 {
			continue
		}
		s := start.Format(time.DateOnly)
		if _, err := p.post(ctx, Event{Tenant: t.ID, Where: VIP(), Type: PayTotal, Key: "pay:" + s, Data: map[string]any{
			"start": s, "end": end.Format(time.DateOnly), "total": total, "people": people,
			"link": Link{Kind: LinkPayPeriod, ID: s},
		}}); err != nil {
			return fmt.Errorf("pay total %s: %w", t.ID, err)
		}
	}
	return nil
}

// Rain tells each open store's chat when rain is coming, and when it is not any more, from its
// cell's forecast (the v1 point's for a store with no place yet). Run after each fetch.
func (p Poster) Rain(ctx context.Context, now time.Time) error {
	q := store.New(p.Pool)
	now = now.In(domain.WIB)
	midnight := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, domain.WIB)
	stores, err := q.OpenStoresForRain(ctx, date(now))
	if err != nil {
		return err
	}
	var hours []int16
	for h := now.Hour(); h <= now.Hour()+2 && h <= 23; h++ {
		hours = append(hours, int16(h))
	}
	for _, s := range stores {
		cell := weather.V1Cell()
		if s.Placed {
			cell = domain.Cell(s.Lat, s.Lng)
		}
		chance, err := q.RainChance(ctx, store.RainChanceParams{Cell: cell, Date: date(now), Hours: hours})
		if err != nil {
			return err
		}
		if chance < 0 {
			continue
		}
		last, err := q.LastRainEvent(ctx, store.LastRainEventParams{StoreID: s.ID, Since: pgtype.Timestamptz{Time: midnight, Valid: true}})
		if err != nil {
			return err
		}
		event := ""
		switch {
		case chance >= RainThreshold && last != RainStarted:
			event = RainStarted
		case chance < RainThreshold && last == RainStarted:
			event = RainStopped
		}
		if event == "" {
			continue
		}
		if _, err := p.post(ctx, Event{Tenant: s.TenantID, Where: Store(s.ID), Type: event, Data: map[string]any{"chance": chance}}); err != nil {
			return fmt.Errorf("rain %s: %w", s.ID, err)
		}
	}
	return nil
}

// Releases posts the newest What's new version to General in every tenant that uses chat,
// once: the worker runs it as it starts, so after each release's deploy.
func (p Poster) Releases(ctx context.Context) error {
	var entries []struct {
		Version string   `json:"version"`
		Apps    []string `json:"apps"`
	}
	notes := whatsNew
	if p.WhatsNew != nil {
		notes = p.WhatsNew
	}
	if err := json.Unmarshal(notes, &entries); err != nil {
		return err
	}
	if len(entries) == 0 {
		return nil
	}
	v := entries[0].Version
	tenants, err := store.New(p.Pool).ListChatTenants(ctx)
	if err != nil {
		return err
	}
	for _, t := range tenants {
		if _, err := p.post(ctx, Event{Tenant: t, Where: General(), Type: Release, Key: "release:" + v, Data: map[string]any{
			"version": v, "link": Link{Kind: LinkWhatsNew, ID: v},
		}}); err != nil {
			return fmt.Errorf("release %s: %w", t, err)
		}
	}
	return nil
}
