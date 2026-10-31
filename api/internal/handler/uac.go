package handler

import (
	"context"
	"errors"
	"net/http"
	"slices"
	"strings"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/auth"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/httpx"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/idem"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/realtime"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
)

var (
	uacAccess = auth.App("backoffice", auth.Guest)
	uacWrite  = auth.App("backoffice", auth.Admin).Idempotent()

	errPersonNotFound = httpx.NotFound("person_not_found", "No such person in this tenant")
	errBadLevel       = httpx.New(http.StatusBadRequest, "bad_level", "That app does not offer that level")
	errOwnerKept      = httpx.New(http.StatusUnprocessableEntity, "owner_kept", "The owner keeps full access: it cannot be lowered or turned off")
	errNotYourself    = httpx.New(http.StatusUnprocessableEntity, "not_yourself", "You cannot turn yourself off")
	errRequestGone    = httpx.NotFound("request_not_found", "No such request waiting")
)

// AccessChanged: someone's levels, stores or status changed; UAC refetches, and their app reloads /me.
const accessChanged = "access"

func registerUac(api huma.API, d Deps) {
	op := func(id, method, path, summary string) huma.Operation {
		return huma.Operation{OperationID: id, Method: method, Path: "/tenants/{tenant}/uac" + path, Summary: summary, Tags: []string{"uac"}}
	}

	route(api, op("getUac", http.MethodGet, "", "Requests waiting and everyone in the tenant, with their levels per app"), uacAccess,
		func(ctx context.Context, _ *contract.TenantInput) (*contract.UacOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			people, err := d.Queries.ListTenantPeople(ctx, store.ListTenantPeopleParams{TenantID: caller.TenantID})
			if err != nil {
				return nil, err
			}
			requests, err := d.Queries.ListPendingRequests(ctx, caller.TenantID)
			if err != nil {
				return nil, err
			}
			out := &contract.UacOutput{}
			out.Body.People = make([]contract.UacPerson, len(people))
			for i, p := range people {
				out.Body.People[i] = uacPerson(p)
			}
			out.Body.Requests = make([]contract.AccessRequest, len(requests))
			for i, r := range requests {
				out.Body.Requests[i] = contract.AccessRequest{
					ID: r.ID.String(), UserID: r.UserID.String(), Name: r.FullName, Email: r.Email,
					AvatarURL: r.AvatarUrl, At: r.CreatedAt.Time,
				}
			}
			return out, nil
		})

	route(api, op("getUacPerson", http.MethodGet, "/people/{userId}", "One person: their levels per app, stores and status"), uacAccess,
		func(ctx context.Context, in *contract.UacPersonInput) (*contract.UacPersonOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			p, err := person(ctx, d.Queries, caller.TenantID, in.UserID)
			if err != nil {
				return nil, err
			}
			out := uacPerson(p)
			out.Bank = &contract.Bank{Name: p.BankName, AccountNumber: p.BankAccountNumber, AccountHolder: p.BankAccountHolder}
			return &contract.UacPersonOutput{Body: out}, nil
		})

	route(api, op("setUacPerson", http.MethodPut, "/people/{userId}", "Set a person's levels per app, stores and status, at once"), uacWrite,
		func(ctx context.Context, in *contract.SetUacPersonInput) (*contract.UacPersonOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			p, err := person(ctx, d.Queries, caller.TenantID, in.UserID)
			if err != nil {
				return nil, err
			}
			if err := setPerson(ctx, idem.Queries(ctx, d.Queries), caller, p, in.Body); err != nil {
				return nil, err
			}
			p, err = person(ctx, idem.Queries(ctx, d.Queries), caller.TenantID, in.UserID)
			if err != nil {
				return nil, err
			}
			return &contract.UacPersonOutput{Body: uacPerson(p)}, nil
		})

	route(api, op("setUacDetails", http.MethodPut, "/people/{userId}/details", "Change a person's name and phone"), uacWrite,
		func(ctx context.Context, in *contract.SetUacDetailsInput) (*contract.UacPersonOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			q := idem.Queries(ctx, d.Queries)
			p, err := person(ctx, q, caller.TenantID, in.UserID)
			if err != nil {
				return nil, err
			}
			name := strings.TrimSpace(in.Body.FullName)
			if name == "" {
				return nil, errBlankName
			}
			if err := q.SetUserProfile(ctx, store.SetUserProfileParams{
				ID:       p.ID,
				FullName: pgtype.Text{String: name, Valid: true},
				Phone:    pgtype.Text{String: strings.TrimSpace(in.Body.Phone), Valid: true},
			}); err != nil {
				return nil, err
			}
			if err := announcePerson(ctx, q, caller, p.ID); err != nil {
				return nil, err
			}
			p, err = person(ctx, q, caller.TenantID, in.UserID)
			if err != nil {
				return nil, err
			}
			return &contract.UacPersonOutput{Body: uacPerson(p)}, nil
		})

	logout := op("logoutUacPerson", http.MethodPost, "/people/{userId}/logout", "Sign a person out of every app on every phone")
	logout.DefaultStatus = http.StatusNoContent
	route(api, logout, uacWrite,
		func(ctx context.Context, in *contract.UacLogoutInput) (*struct{}, error) {
			caller, _ := auth.CallerFrom(ctx)
			q := idem.Queries(ctx, d.Queries)
			p, err := person(ctx, q, caller.TenantID, in.UserID)
			if err != nil {
				return nil, err
			}
			if p.IsOwner && p.ID != caller.UserID {
				return nil, errOwnerKept
			}
			// Through Sessions, not the write's q: it also forgets them in its memory.
			if err := d.Sessions.DeleteAll(ctx, p.ID); err != nil {
				return nil, err
			}
			return nil, realtime.Announce(ctx, q, realtime.Event{Topic: realtime.UserTopic(p.ID.String()), Kind: realtime.SignedOut})
		})

	route(api, huma.Operation{
		OperationID:   "askAccess",
		Method:        http.MethodPost,
		Path:          "/access-requests",
		Summary:       "Ask a tenant to let the caller in",
		Tags:          []string{"uac"},
		DefaultStatus: http.StatusNoContent,
	}, auth.SignedIn.RateLimit().Repeatable(), func(ctx context.Context, in *contract.AskAccessInput) (*struct{}, error) {
		caller, _ := auth.CallerFrom(ctx)
		// Always the same answer: a slug that is no tenant, or a blocked person, learns nothing.
		made, err := d.Queries.AskAccess(ctx, store.AskAccessParams{UserID: caller.UserID, Slug: in.Body.Tenant})
		if err != nil {
			return nil, err
		}
		for _, tenant := range made {
			if err := realtime.Announce(ctx, d.Queries, realtime.Event{Topic: realtime.TenantTopic(tenant.String()), Kind: accessChanged}); err != nil {
				return nil, err
			}
		}
		return nil, nil
	})

	route(api, op("getUacRequest", http.MethodGet, "/requests/{id}", "One request waiting"), uacAccess,
		func(ctx context.Context, in *contract.UacRequestInput) (*contract.UacRequestOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			r, err := pendingRequest(ctx, d.Queries, caller.TenantID, in.ID)
			if err != nil {
				return nil, err
			}
			return &contract.UacRequestOutput{Body: contract.AccessRequest{
				ID: r.ID.String(), UserID: r.UserID.String(), Name: r.FullName, Email: r.Email,
				AvatarURL: r.AvatarUrl, At: r.CreatedAt.Time,
			}}, nil
		})

	route(api, op("approveUacRequest", http.MethodPost, "/requests/{id}/approve", "Let the person in with these levels and stores"), uacWrite,
		func(ctx context.Context, in *contract.ApproveRequestInput) (*contract.UacPersonOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			q := idem.Queries(ctx, d.Queries)
			r, err := pendingRequest(ctx, q, caller.TenantID, in.ID)
			if err != nil {
				return nil, err
			}
			if err := q.AddMember(ctx, store.AddMemberParams{TenantID: caller.TenantID, UserID: r.UserID}); err != nil {
				return nil, err
			}
			p, err := person(ctx, q, caller.TenantID, r.UserID.String())
			if err != nil {
				return nil, err
			}
			in.Body.Active = true
			if err := setPerson(ctx, q, caller, p, in.Body); err != nil {
				return nil, err
			}
			if _, err := q.DecideRequest(ctx, store.DecideRequestParams{ID: r.ID, TenantID: caller.TenantID, Status: "approved", DecidedBy: caller.UserID}); err != nil {
				return nil, err
			}
			if err := q.ActivateUser(ctx, r.UserID); err != nil {
				return nil, err
			}
			p, err = person(ctx, q, caller.TenantID, r.UserID.String())
			if err != nil {
				return nil, err
			}
			return &contract.UacPersonOutput{Body: uacPerson(p)}, nil
		})

	reject := op("rejectUacRequest", http.MethodPost, "/requests/{id}/reject", "Turn a request down, or block the person's later asks too")
	reject.DefaultStatus = http.StatusNoContent
	route(api, reject, uacWrite,
		func(ctx context.Context, in *contract.RejectRequestInput) (*struct{}, error) {
			caller, _ := auth.CallerFrom(ctx)
			q := idem.Queries(ctx, d.Queries)
			r, err := pendingRequest(ctx, q, caller.TenantID, in.ID)
			if err != nil {
				return nil, err
			}
			status := "rejected"
			if in.Body.Block {
				status = "blocked"
			}
			if _, err := q.DecideRequest(ctx, store.DecideRequestParams{ID: r.ID, TenantID: caller.TenantID, Status: status, DecidedBy: caller.UserID}); err != nil {
				return nil, err
			}
			for _, topic := range []string{realtime.TenantTopic(caller.TenantID.String()), realtime.UserTopic(r.UserID.String())} {
				if err := realtime.Announce(ctx, q, realtime.Event{Topic: topic, Kind: accessChanged, ID: r.UserID.String()}); err != nil {
					return nil, err
				}
			}
			return nil, nil
		})
}

func pendingRequest(ctx context.Context, q *store.Queries, tenant pgtype.UUID, id string) (store.GetPendingRequestRow, error) {
	rid, err := uuid(id, errRequestGone)
	if err != nil {
		return store.GetPendingRequestRow{}, err
	}
	r, err := q.GetPendingRequest(ctx, store.GetPendingRequestParams{ID: rid, TenantID: tenant})
	if errors.Is(err, pgx.ErrNoRows) {
		return r, errRequestGone
	}
	return r, err
}

func person(ctx context.Context, q *store.Queries, tenant pgtype.UUID, userID string) (store.ListTenantPeopleRow, error) {
	id, err := uuid(userID, errPersonNotFound)
	if err != nil {
		return store.ListTenantPeopleRow{}, err
	}
	rows, err := q.ListTenantPeople(ctx, store.ListTenantPeopleParams{TenantID: tenant, UserID: id})
	if err != nil {
		return store.ListTenantPeopleRow{}, err
	}
	if len(rows) == 0 {
		return store.ListTenantPeopleRow{}, errPersonNotFound
	}
	return rows[0], nil
}

// setPerson writes everything about one person on q (the write's transaction), checked first:
// levels the apps offer, the tenant's own stores, the owner untouched, nobody turning themselves off.
func setPerson(ctx context.Context, q *store.Queries, caller auth.Caller, p store.ListTenantPeopleRow, c contract.UacPersonChange) error {
	if !c.Active {
		// Off is off: None in every app and no stores, also after turning them back on.
		c.Access, c.StoreIDs = contract.MeAccess{}, nil
	}
	if p.IsOwner {
		// The page shows an owner as admin in every app, and sends that back; stored as the app offers it.
		if c.Access.Seller == string(auth.Admin) {
			c.Access.Seller = string(auth.Member)
		}
		if !c.Active || c.Access.Seller != string(auth.Member) || c.Access.Backoffice != string(auth.Admin) {
			return errOwnerKept
		}
		if p.ID != caller.UserID && !sameStores(p.StoreIds, c.StoreIDs) {
			return errOwnerKept
		}
	}
	levels := map[string]string{"seller": c.Access.Seller, "backoffice": c.Access.Backoffice}
	for app, level := range levels {
		if level != "" && !slices.Contains(auth.Levels[app], auth.Level(level)) {
			return errBadLevel
		}
	}
	if p.ID == caller.UserID && !c.Active {
		return errNotYourself
	}
	ids := make([]pgtype.UUID, len(c.StoreIDs))
	for i, s := range c.StoreIDs {
		if err := ids[i].Scan(s); err != nil {
			return errNotAStore
		}
	}
	if n, err := q.CountTenantStores(ctx, store.CountTenantStoresParams{TenantID: caller.TenantID, Ids: ids}); err != nil {
		return err
	} else if int(n) != len(uniq(c.StoreIDs)) {
		return errStoreNotFound
	}

	for app, level := range levels {
		key := store.SetAppAccessParams{TenantID: caller.TenantID, UserID: p.ID, App: app, Access: level}
		if level == "" {
			err := q.RemoveAppAccess(ctx, store.RemoveAppAccessParams{TenantID: key.TenantID, UserID: key.UserID, App: app})
			if err != nil {
				return err
			}
			continue
		}
		if err := q.SetAppAccess(ctx, key); err != nil {
			return err
		}
	}
	status := "active"
	if !c.Active {
		// users.status can stay active for someone in another tenant: without stores, v1 shows them nothing here.
		status = "inactive"
	}
	if _, err := q.SetMembershipStatus(ctx, store.SetMembershipStatusParams{TenantID: caller.TenantID, UserID: p.ID, Status: status}); err != nil {
		return err
	}
	if err := q.SetUserStores(ctx, store.SetUserStoresParams{TenantID: caller.TenantID, UserID: p.ID, StoreIds: ids}); err != nil {
		return err
	}
	if err := q.SyncUserRole(ctx, p.ID); err != nil {
		return err
	}
	if err := q.SyncUserStatus(ctx, p.ID); err != nil {
		return err
	}
	return announcePerson(ctx, q, caller, p.ID)
}

func sameStores(have []pgtype.UUID, want []string) bool {
	got := make([]string, len(have))
	for i, id := range have {
		got[i] = id.String()
	}
	w := slices.Clone(want)
	slices.Sort(got)
	slices.Sort(w)
	return slices.Equal(got, slices.Compact(w))
}

func announcePerson(ctx context.Context, q *store.Queries, caller auth.Caller, id pgtype.UUID) error {
	for _, topic := range []string{realtime.TenantTopic(caller.TenantID.String()), realtime.UserTopic(id.String())} {
		if err := realtime.Announce(ctx, q, realtime.Event{Topic: topic, Kind: accessChanged, ID: id.String()}); err != nil {
			return err
		}
	}
	return nil
}

func uacPerson(p store.ListTenantPeopleRow) contract.UacPerson {
	level := func(app, access string) string {
		return string(auth.LevelIn(app, auth.Membership{Status: p.Status, Owner: p.IsOwner, Access: access, HasLevels: p.HasLevels, Role: p.Role}))
	}
	out := contract.UacPerson{
		ID: p.ID.String(), Name: p.FullName, Email: p.Email, AvatarURL: p.AvatarUrl,
		Phone: p.Phone, Since: since(p.CreatedAt),
		Active: p.Status == "active", Owner: p.IsOwner,
		Access:           contract.MeAccess{Seller: level("seller", p.SellerAccess), Backoffice: level("backoffice", p.BackofficeAccess)},
		StoreIDs:         make([]string, len(p.StoreIds)),
		CommissionTypeID: p.CommissionTypeID, CommissionName: p.CommissionName, CommissionRate: p.CommissionRate,
		ClaimTypeIDs: make([]string, len(p.ClaimTypeIds)),
	}
	for i, id := range p.StoreIds {
		out.StoreIDs[i] = id.String()
	}
	for i, id := range p.ClaimTypeIds {
		out.ClaimTypeIDs[i] = id.String()
	}
	return out
}
