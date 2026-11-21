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
	if len(days) > 0 {
		rows, err := q.LinkDays(ctx, store.LinkDaysParams{Ids: days, TenantID: caller.TenantID})
		if err != nil {
			return err
		}
		for _, r := range rows {
			dayRows[r.ID.String()] = r
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
		end           string
		total, people int64
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
				if r.Commissions+r.Claims > 0 {
					p.total += r.Commissions + r.Claims
					p.people++
				}
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
			}
		case chatevent.LinkPayout:
			if r, ok := payoutRows[l.ID]; ok {
				l.Open, l.Person, l.UserID, l.Start, l.End, l.Total = true, r.FullName, r.UserID.String(), day0(r.StartDate), day0(r.EndDate), &r.Total
			}
		case chatevent.LinkPayPeriod:
			if p, ok := periodRows[l.ID]; ok {
				l.Open, l.Start, l.End, l.Total, l.People = true, l.ID, p.end, &p.total, &p.people
			}
		}
	}
	return nil
}

// linkMetadata is a user message's metadata: its link, or nothing.
func linkMetadata(link *chatevent.Link) ([]byte, error) {
	if link == nil {
		return []byte("{}"), nil
	}
	return json.Marshal(map[string]any{"link": link})
}
