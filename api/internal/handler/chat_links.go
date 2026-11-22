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

// resolveLinks fills each link's screen for a reader who may open it, a page at a time: one read
// per kind. What's new carries its lines for everyone.
func resolveLinks(ctx context.Context, q *store.Queries, caller auth.Caller, items []contract.ChatMessage) error {
	var days, payouts []pgtype.UUID
	periods := map[string]bool{}
	for _, m := range items {
		if m.Link == nil {
			continue
		}
		if m.Link.Kind == chatevent.LinkWhatsNew {
			m.Link.Open = true
			m.Link.Notes = releaseNotes(m.Link.ID)
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
	dayScreens, err := dayPreviews(ctx, q, caller, days)
	if err != nil {
		return err
	}
	payslips, err := payslipPreviews(ctx, q, caller, payouts)
	if err != nil {
		return err
	}
	periodScreens, err := periodPreviews(ctx, q, caller, periods)
	if err != nil {
		return err
	}
	for _, m := range items {
		l := m.Link
		if l == nil {
			continue
		}
		switch l.Kind {
		case chatevent.LinkDay:
			if d, ok := dayScreens[l.ID]; ok {
				l.Open, l.Store, l.StoreID, l.Date, l.Cups, l.Day = true, d.screen.Store, d.storeID, d.screen.Date, &d.screen.Cups, d.screen
			}
		case chatevent.LinkPayout:
			if p, ok := payslips[l.ID]; ok {
				l.Open, l.Person, l.UserID, l.Start, l.End, l.Total = true, p.screen.Person, p.userID, p.screen.Start, p.screen.End, &p.screen.Total
				l.Payslip = p.screen
			}
		case chatevent.LinkPayPeriod:
			if p, ok := periodScreens[l.ID]; ok {
				total, people := p.ToPay+p.Paid, int64(len(p.People)+p.More)
				l.Open, l.Start, l.End, l.Total, l.People, l.Period = true, l.ID, p.End, &total, &people, p
			}
		}
	}
	return nil
}

// previewPeople: a screen in chat lists this many people at most, then "and N more".
const previewPeople = 5

func shortList(rows []contract.PreviewPerson) ([]contract.PreviewPerson, int) {
	if len(rows) <= previewPeople {
		return rows, 0
	}
	return rows[:previewPeople], len(rows) - previewPeople
}

type dayScreen struct {
	screen  *contract.DayPreview
	storeID string
}

// dayPreviews is the top of each day's screen: who opened it, its numbers, who worked.
func dayPreviews(ctx context.Context, q *store.Queries, caller auth.Caller, ids []pgtype.UUID) (map[string]dayScreen, error) {
	out := map[string]dayScreen{}
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := q.LinkDays(ctx, store.LinkDaysParams{Ids: ids, TenantID: caller.TenantID})
	if err != nil {
		return nil, err
	}
	sellers, err := q.ListDaySellers(ctx, ids)
	if err != nil {
		return nil, err
	}
	people := map[string][]contract.PreviewPerson{}
	for _, r := range sellers {
		k := r.DailySummaryID.String()
		people[k] = append(people[k], contract.PreviewPerson{Name: r.FullName, Avatar: r.AvatarUrl.String, Value: r.Cups})
	}
	for _, r := range rows {
		d := &contract.DayPreview{
			Date: day0(r.Date), Store: r.StoreName, Closed: r.Closed, OpenedBy: r.OpenedBy, OpenedAt: tsz(r.OpenedAt),
			Sales: r.Sales, Orders: r.Orders, Cups: r.Cups, Expenses: r.Expenses, Expected: r.Opening + r.Sales - r.Expenses,
			Sellers: people[r.ID.String()],
		}
		if d.Sellers == nil {
			d.Sellers = []contract.PreviewPerson{}
		}
		if r.Closed {
			d.Counted = &r.Counted
		}
		out[r.ID.String()] = dayScreen{screen: d, storeID: r.StoreID.String()}
	}
	return out, nil
}

type payslipScreen struct {
	screen *contract.PayslipPreview
	userID string
}

// payslipPreviews is the top of each payslip: its week, numbers, and how it was paid.
func payslipPreviews(ctx context.Context, q *store.Queries, caller auth.Caller, ids []pgtype.UUID) (map[string]payslipScreen, error) {
	out := map[string]payslipScreen{}
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := q.LinkPayouts(ctx, store.LinkPayoutsParams{Ids: ids, TenantID: caller.TenantID})
	if err != nil {
		return nil, err
	}
	for _, r := range rows {
		out[r.ID.String()] = payslipScreen{userID: r.UserID.String(), screen: &contract.PayslipPreview{
			Person: r.FullName, Start: day0(r.StartDate), End: day0(r.EndDate), Status: r.Status,
			Orders: r.Orders, Cups: r.Cups, Total: r.Commissions + r.Claims,
			PaidAt: tsz(r.PaidAt), PaidBy: r.PaidBy, Receipt: r.Receipt,
		}}
	}
	return out, nil
}

// periodPreviews is the Pay tab at each period: what is owed and paid, and each person.
func periodPreviews(ctx context.Context, q *store.Queries, caller auth.Caller, starts map[string]bool) (map[string]*contract.PeriodPreview, error) {
	out := map[string]*contract.PeriodPreview{}
	if len(starts) == 0 {
		return out, nil
	}
	frequency, err := q.GetPayFrequency(ctx, caller.TenantID)
	if err != nil {
		return nil, err
	}
	for s := range starts {
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
			return nil, err
		}
		p := &contract.PeriodPreview{Start: s, End: end.Format(time.DateOnly)}
		var people []contract.PreviewPerson
		for _, r := range rows {
			t := r.Commissions + r.Claims
			if t == 0 && r.Pending == 0 {
				continue // as the Pay tab: nothing owed and nothing waiting is noise
			}
			if r.Status == "paid" {
				p.Paid += t
			} else if r.Status == "pending" {
				p.ToPay += t
			}
			if r.Pending > 0 {
				p.ToReview++
			}
			people = append(people, contract.PreviewPerson{Name: r.FullName, Avatar: r.AvatarUrl.String, Value: t, Status: r.Status})
		}
		p.People, p.More = shortList(people)
		if p.People == nil {
			p.People = []contract.PreviewPerson{}
		}
		out[s] = p
	}
	return out, nil
}

// releaseNotes is a What's new version's lines, per app, from Go's copy of the file.
func releaseNotes(version string) []contract.ReleaseNote {
	var out []contract.ReleaseNote
	for _, e := range chatevent.WhatsNew() {
		if e.Version == version {
			out = append(out, contract.ReleaseNote{Apps: e.Apps, Lines: e.Lines})
		}
	}
	return out
}

// linkMetadata is a user message's metadata: its link, or nothing.
func linkMetadata(link *chatevent.Link) ([]byte, error) {
	if link == nil {
		return []byte("{}"), nil
	}
	return json.Marshal(map[string]any{"link": link})
}
