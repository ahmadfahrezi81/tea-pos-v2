package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/auth"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/chatevent"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/domain"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/httpx"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
)

// errLinkNotFound: a shared screen the caller cannot open (not theirs to see, or gone).
var errLinkNotFound = httpx.New(http.StatusNotFound, "link_not_found", "That screen was not found")

// linkOf is a message's link, from its metadata.
func linkOf(raw []byte) *contract.ChatLink {
	var m struct {
		Link *chatevent.Link `json:"link"`
	}
	if len(raw) == 0 || json.Unmarshal(raw, &m) != nil || m.Link == nil || m.Link.Kind == "" {
		return nil
	}
	return &contract.ChatLink{Kind: m.Link.Kind, ID: m.Link.ID}
}

// canOpenLinks: the shared screens are the backoffice's, so only it opens them for now (Step 75;
// the seller app's views come with Step 71). What's new opens in either.
func canOpenLinks(caller auth.Caller) bool {
	return caller.App == "backoffice" && caller.Level != auth.None
}

// sharedLink checks a screen shared by the caller exists in their tenant and is theirs to open.
func sharedLink(ctx context.Context, q *store.Queries, caller auth.Caller, in *contract.ChatLinkInput) (chatevent.Link, error) {
	link := chatevent.Link{Kind: in.Kind, ID: in.ID}
	if !canOpenLinks(caller) {
		return link, errLinkNotFound
	}
	switch in.Kind {
	case chatevent.LinkDay, chatevent.LinkPayout:
		id, err := uuid(in.ID, errLinkNotFound)
		if err != nil {
			return link, err
		}
		ids := []pgtype.UUID{id}
		n := 0
		if in.Kind == chatevent.LinkDay {
			rows, err := q.LinkDays(ctx, store.LinkDaysParams{Ids: ids, TenantID: caller.TenantID})
			if err != nil {
				return link, err
			}
			n = len(rows)
		} else {
			rows, err := q.LinkPayouts(ctx, store.LinkPayoutsParams{Ids: ids, TenantID: caller.TenantID})
			if err != nil {
				return link, err
			}
			n = len(rows)
		}
		if n == 0 {
			return link, errLinkNotFound
		}
	case chatevent.LinkPayPeriod:
		day, err := time.Parse(time.DateOnly, in.ID)
		if err != nil {
			return link, errLinkNotFound
		}
		frequency, err := q.GetPayFrequency(ctx, caller.TenantID)
		if err != nil {
			return link, err
		}
		start, _, err := domain.PayWindow(day, frequency)
		if err != nil {
			return link, err
		}
		link.ID = start.Format(time.DateOnly)
	default:
		return link, errLinkNotFound
	}
	return link, nil
}

// resolveLinks fills each link's card for a reader who may open it, a page at a time: one read
// per kind.
func resolveLinks(ctx context.Context, q *store.Queries, caller auth.Caller, items []contract.ChatMessage) error {
	var days, payouts []pgtype.UUID
	periods := map[string]bool{}
	for _, m := range items {
		if m.Link == nil {
			continue
		}
		if m.Link.Kind == chatevent.LinkWhatsNew {
			m.Link.Open = true
			continue
		}
		if !canOpenLinks(caller) {
			continue
		}
		var id pgtype.UUID
		switch m.Link.Kind {
		case chatevent.LinkDay:
			if id.Scan(m.Link.ID) == nil {
				days = append(days, id)
			}
		case chatevent.LinkPayout:
			if id.Scan(m.Link.ID) == nil {
				payouts = append(payouts, id)
			}
		case chatevent.LinkPayPeriod:
			periods[m.Link.ID] = true
		}
	}
	dayRows := map[string]store.LinkDaysRow{}
	daySellers := map[string][]contract.PreviewRow{}
	if len(days) > 0 {
		rows, err := q.LinkDays(ctx, store.LinkDaysParams{Ids: days, TenantID: caller.TenantID})
		if err != nil {
			return err
		}
		for _, r := range rows {
			dayRows[r.ID.String()] = r
		}
		sellers, err := q.ListDaySellers(ctx, days)
		if err != nil {
			return err
		}
		for _, r := range sellers {
			k := r.DailySummaryID.String()
			daySellers[k] = append(daySellers[k], contract.PreviewRow{Name: r.FullName, Avatar: r.AvatarUrl.String, Value: r.Cups, Unit: "cups"})
		}
	}
	payoutRows := map[string]store.LinkPayoutsRow{}
	if len(payouts) > 0 {
		rows, err := q.LinkPayouts(ctx, store.LinkPayoutsParams{Ids: payouts, TenantID: caller.TenantID})
		if err != nil {
			return err
		}
		for _, r := range rows {
			payoutRows[r.ID.String()] = r
		}
	}
	type period struct {
		end                 string
		total, people, paid int64
		rows                []contract.PreviewRow
	}
	periodRows := map[string]period{}
	if len(periods) > 0 {
		frequency, err := q.GetPayFrequency(ctx, caller.TenantID)
		if err != nil {
			return err
		}
		for s := range periods {
			day, err := time.Parse(time.DateOnly, s)
			if err != nil {
				continue
			}
			start, end, err := domain.PayWindow(day, frequency)
			if err != nil || start.Format(time.DateOnly) != s {
				continue // the schedule changed since: no longer a period's first day
			}
			rows, err := q.ListPayouts(ctx, store.ListPayoutsParams{TenantID: caller.TenantID, FromDate: date(start), ToDate: date(end)})
			if err != nil {
				return err
			}
			p := period{end: end.Format(time.DateOnly)}
			for _, r := range rows {
				t := r.Commissions + r.Claims
				if t == 0 {
					continue
				}
				p.total += t
				p.people++
				if r.Status == "paid" {
					p.paid += t
				}
				p.rows = append(p.rows, contract.PreviewRow{Name: r.FullName, Avatar: r.AvatarUrl.String, Value: t, Unit: "money", Status: r.Status})
			}
			periodRows[s] = p
		}
	}
	for _, m := range items {
		l := m.Link
		if l == nil {
			continue
		}
		switch l.Kind {
		case chatevent.LinkDay:
			if r, ok := dayRows[l.ID]; ok {
				l.Open, l.Store, l.StoreID, l.Date, l.Cups = true, r.StoreName, r.StoreID.String(), day0(r.Date), &r.Cups
				l.Preview = dayPreview(r, daySellers[l.ID])
			}
		case chatevent.LinkPayout:
			if r, ok := payoutRows[l.ID]; ok {
				total := r.Commissions + r.Claims
				l.Open, l.Person, l.UserID, l.Start, l.End, l.Total = true, r.FullName, r.UserID.String(), day0(r.StartDate), day0(r.EndDate), &total
				l.Preview = &contract.LinkPreview{Status: r.Status, Stats: []contract.PreviewStat{
					{Label: "commissions", Value: r.Commissions, Unit: "money"},
					{Label: "claims", Value: r.Claims, Unit: "money"},
					{Label: "total", Value: total, Unit: "money"},
				}}
			}
		case chatevent.LinkPayPeriod:
			if p, ok := periodRows[l.ID]; ok {
				l.Open, l.Start, l.End, l.Total, l.People = true, l.ID, p.end, &p.total, &p.people
				l.Preview = &contract.LinkPreview{Stats: []contract.PreviewStat{
					{Label: "total", Value: p.total, Unit: "money"},
					{Label: "paid", Value: p.paid, Unit: "money"},
					{Label: "toPay", Value: p.total - p.paid, Unit: "money"},
				}}
				l.Preview.Rows, l.Preview.More = shortList(p.rows)
			}
		}
	}
	return nil
}

// previewRows: a card lists this many people at most, then "and N more".
const previewRows = 5

func shortList(rows []contract.PreviewRow) ([]contract.PreviewRow, int) {
	if len(rows) <= previewRows {
		return rows, 0
	}
	return rows[:previewRows], len(rows) - previewRows
}

// dayPreview is the top of a day's screen: sales, cups, orders, expenses, the cash, who worked.
func dayPreview(r store.LinkDaysRow, sellers []contract.PreviewRow) *contract.LinkPreview {
	status := "open"
	if r.Closed {
		status = "closed"
	}
	p := &contract.LinkPreview{Status: status, Stats: []contract.PreviewStat{
		{Label: "sales", Value: r.Sales, Unit: "money"},
		{Label: "cups", Value: r.Cups, Unit: "count"},
		{Label: "orders", Value: r.Orders, Unit: "count"},
		{Label: "expenses", Value: r.Expenses, Unit: "money"},
		{Label: "expected", Value: r.Opening + r.Sales - r.Expenses, Unit: "money"},
	}}
	if r.Closed {
		p.Stats = append(p.Stats, contract.PreviewStat{Label: "counted", Value: r.Counted, Unit: "money"})
	}
	p.Rows, p.More = shortList(sellers)
	return p
}

// linkMetadata is a user message's metadata: its link, or nothing.
func linkMetadata(link *chatevent.Link) ([]byte, error) {
	if link == nil {
		return []byte("{}"), nil
	}
	return json.Marshal(map[string]any{"link": link})
}
