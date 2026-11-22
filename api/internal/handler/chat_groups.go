package handler

import (
	"context"
	"net/http"
	"strings"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/auth"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/httpx"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/idem"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
)

var (
	errBlankGroupName = httpx.New(http.StatusUnprocessableEntity, "blank_group_name", "Give the group a name")
	errBadPerson      = httpx.New(http.StatusBadRequest, "bad_request", "Not a person")
)

// chatAdminAccess: groups are made and run by chat admins (RFC: Chat (v2), Step 70).
var chatAdminAccess = auth.App(auth.Chat, auth.Admin)

// registerChatGroups: groups, Follow, and a person's Group chats in UAC (task 070).
func registerChatGroups(api huma.API, d Deps) {
	op := func(id, method, path, summary string) huma.Operation {
		return huma.Operation{OperationID: id, Method: method, Path: "/tenants/{tenant}/chat" + path, Summary: summary, Tags: []string{"chat"}}
	}

	route(api, op("listChatPeople", http.MethodGet, "/people", "Everyone with a chat level: who a group can be made of"), chatAdminAccess,
		func(ctx context.Context, in *contract.ChatPeopleInput) (*contract.ChatPeopleOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			rows, err := d.Queries.ListChatPeople(ctx, caller.TenantID)
			if err != nil {
				return nil, err
			}
			inGroup := map[pgtype.UUID]bool{}
			if in.Group != "" {
				ch, err := chatGroup(ctx, d.Queries, caller, in.Group)
				if err != nil {
					return nil, err
				}
				ids, err := d.Queries.ListChatGroupMembers(ctx, ch.ID)
				if err != nil {
					return nil, err
				}
				for _, id := range ids {
					inGroup[id] = true
				}
			}
			out := &contract.ChatPeopleOutput{}
			out.Body.People = make([]contract.ChatPerson, len(rows))
			for i, r := range rows {
				out.Body.People[i] = contract.ChatPerson{ID: r.ID.String(), Name: r.FullName, Avatar: r.AvatarUrl, In: inGroup[r.ID]}
			}
			return out, nil
		})

	route(api, op("createChatGroup", http.MethodPost, "/groups", "Make a group with its people"), chatAdminAccess.Idempotent(),
		func(ctx context.Context, in *contract.CreateChatGroupInput) (*contract.ChatGroupOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			name := strings.TrimSpace(in.Body.Name)
			if name == "" {
				return nil, errBlankGroupName
			}
			members, err := uuids(in.Body.Members)
			if err != nil {
				return nil, err
			}
			q := idem.Queries(ctx, d.Queries)
			id, err := q.CreateChatGroup(ctx, store.CreateChatGroupParams{
				TenantID: caller.TenantID, Name: pgtype.Text{String: name, Valid: true}, CreatedBy: caller.UserID,
			})
			if err != nil {
				return nil, err
			}
			if err := q.SetChatGroupMembers(ctx, store.SetChatGroupMembersParams{
				ChannelID: id, AddedBy: caller.UserID, TenantID: caller.TenantID, UserIds: members,
			}); err != nil {
				return nil, err
			}
			// Its maker hears of it even when not one of its people.
			if err := announceChat(ctx, q, chatChanged, id, []pgtype.UUID{caller.UserID}); err != nil {
				return nil, err
			}
			out := &contract.ChatGroupOutput{}
			out.Body.ID = id.String()
			return out, announceMembers(ctx, q, id)
		})

	route(api, op("updateChatGroup", http.MethodPatch, "/groups/{id}", "Rename a group, or archive it (read only) and back"), chatAdminAccess.Repeatable(),
		func(ctx context.Context, in *contract.UpdateChatGroupInput) (*struct{}, error) {
			caller, _ := auth.CallerFrom(ctx)
			ch, err := chatGroup(ctx, d.Queries, caller, in.ID)
			if err != nil {
				return nil, err
			}
			p := store.UpdateChatGroupParams{ID: ch.ID, TenantID: caller.TenantID}
			if in.Body.Name != nil {
				name := strings.TrimSpace(*in.Body.Name)
				if name == "" {
					return nil, errBlankGroupName
				}
				p.Name = pgtype.Text{String: name, Valid: true}
			}
			if in.Body.Archived != nil {
				p.Archived = pgtype.Bool{Bool: *in.Body.Archived, Valid: true}
			}
			if _, err := d.Queries.UpdateChatGroup(ctx, p); err != nil {
				return nil, err
			}
			return nil, announceMembers(ctx, d.Queries, ch.ID)
		})

	route(api, op("setChatGroupMembers", http.MethodPut, "/groups/{id}/members", "Set a group's people, the whole list"), chatAdminAccess.Repeatable(),
		func(ctx context.Context, in *contract.SetChatGroupMembersInput) (*struct{}, error) {
			caller, _ := auth.CallerFrom(ctx)
			ch, err := chatGroup(ctx, d.Queries, caller, in.ID)
			if err != nil {
				return nil, err
			}
			members, err := uuids(in.Body.Members)
			if err != nil {
				return nil, err
			}
			// Whoever leaves hears of it too: the group leaves their list.
			before, err := d.Queries.ListChatGroupMembers(ctx, ch.ID)
			if err != nil {
				return nil, err
			}
			if err := d.Queries.SetChatGroupMembers(ctx, store.SetChatGroupMembersParams{
				ChannelID: ch.ID, AddedBy: caller.UserID, TenantID: caller.TenantID, UserIds: members,
			}); err != nil {
				return nil, err
			}
			if err := announceChat(ctx, d.Queries, chatChanged, ch.ID, before); err != nil {
				return nil, err
			}
			return nil, announceMembers(ctx, d.Queries, ch.ID)
		})

	follow := func(on bool) func(context.Context, *contract.ChatChannelInput) (*struct{}, error) {
		return func(ctx context.Context, in *contract.ChatChannelInput) (*struct{}, error) {
			caller, _ := auth.CallerFrom(ctx)
			ch, err := chatChannel(ctx, d.Queries, caller, in.ID)
			if err != nil {
				return nil, err
			}
			if err := d.Queries.SetChatFollow(ctx, store.SetChatFollowParams{UserID: caller.UserID, ChannelID: ch.ID, Follow: on}); err != nil {
				return nil, err
			}
			return nil, announceChat(ctx, d.Queries, chatChanged, ch.ID, []pgtype.UUID{caller.UserID})
		}
	}
	route(api, huma.Operation{
		OperationID: "followChatChannel", Method: http.MethodPut, Path: "/tenants/{tenant}/chat/channels/{id}/follow",
		Summary: "A chat admin follows a channel they are not in: its badge and pushes", Tags: []string{"chat"}, DefaultStatus: http.StatusNoContent,
	}, chatAdminAccess.Repeatable(), follow(true))
	route(api, huma.Operation{
		OperationID: "unfollowChatChannel", Method: http.MethodDelete, Path: "/tenants/{tenant}/chat/channels/{id}/follow",
		Summary: "Stop following a channel", Tags: []string{"chat"}, DefaultStatus: http.StatusNoContent,
	}, chatAdminAccess.Repeatable(), follow(false))

	uac := func(id, method, summary string) huma.Operation {
		return huma.Operation{OperationID: id, Method: method, Path: "/tenants/{tenant}/uac/people/{userId}/chat-groups", Summary: summary, Tags: []string{"uac"}}
	}
	route(api, uac("getUacChatGroups", http.MethodGet, "Every group chat, and whether this person is in it"), uacAccess,
		func(ctx context.Context, in *contract.UacPersonInput) (*contract.UserChatGroupsOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			p, err := person(ctx, d.Queries, caller.TenantID, in.UserID)
			if err != nil {
				return nil, err
			}
			rows, err := d.Queries.ListUserChatGroups(ctx, store.ListUserChatGroupsParams{TenantID: caller.TenantID, UserID: p.ID})
			if err != nil {
				return nil, err
			}
			out := &contract.UserChatGroupsOutput{}
			out.Body.Groups = make([]contract.UserChatGroup, len(rows))
			for i, r := range rows {
				out.Body.Groups[i] = contract.UserChatGroup{ID: r.ID.String(), Name: r.Name, Archived: r.Archived, Member: r.Member}
			}
			return out, nil
		})
	route(api, uac("setUacChatGroups", http.MethodPut, "Set the group chats a person is in, the whole list"), uacWrite,
		func(ctx context.Context, in *contract.SetUserChatGroupsInput) (*contract.UserChatGroupsOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			p, err := person(ctx, d.Queries, caller.TenantID, in.UserID)
			if err != nil {
				return nil, err
			}
			groups, err := uuids(in.Body.Groups)
			if err != nil {
				return nil, err
			}
			q := idem.Queries(ctx, d.Queries)
			was, err := q.ListUserChatGroups(ctx, store.ListUserChatGroupsParams{TenantID: caller.TenantID, UserID: p.ID})
			if err != nil {
				return nil, err
			}
			before := map[pgtype.UUID]bool{}
			for _, r := range was {
				before[r.ID] = r.Member
			}
			if err := q.SetUserChatGroups(ctx, store.SetUserChatGroupsParams{
				UserID: p.ID, AddedBy: caller.UserID, TenantID: caller.TenantID, ChannelIds: groups,
			}); err != nil {
				return nil, err
			}
			rows, err := q.ListUserChatGroups(ctx, store.ListUserChatGroupsParams{TenantID: caller.TenantID, UserID: p.ID})
			if err != nil {
				return nil, err
			}
			out := &contract.UserChatGroupsOutput{}
			out.Body.Groups = make([]contract.UserChatGroup, len(rows))
			for i, r := range rows {
				out.Body.Groups[i] = contract.UserChatGroup{ID: r.ID.String(), Name: r.Name, Archived: r.Archived, Member: r.Member}
				// Every group whose people changed tells its people, and the person.
				if r.Member != before[r.ID] {
					if err := announceChat(ctx, q, chatChanged, r.ID, []pgtype.UUID{p.ID}); err != nil {
						return nil, err
					}
					if err := announceMembers(ctx, q, r.ID); err != nil {
						return nil, err
					}
				}
			}
			return out, nil
		})
}

// chatGroup is one of the tenant's groups (a chat admin may open any).
func chatGroup(ctx context.Context, q *store.Queries, caller auth.Caller, id string) (store.GetChatChannelRow, error) {
	ch, err := chatChannel(ctx, q, caller, id)
	if err != nil {
		return ch, err
	}
	if ch.Kind != "group" {
		return ch, errChannelNotFound
	}
	return ch, nil
}

// uuids reads a list of ids; one that is not an id refuses the whole list.
func uuids(ss []string) ([]pgtype.UUID, error) {
	out := make([]pgtype.UUID, 0, len(ss))
	for _, s := range ss {
		var id pgtype.UUID
		if err := id.Scan(s); err != nil {
			return nil, errBadPerson
		}
		out = append(out, id)
	}
	return out, nil
}
