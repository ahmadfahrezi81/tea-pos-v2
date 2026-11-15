//go:build integration

package integration

import (
	"context"
	"encoding/json"
	"net/http"
	"sort"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/tests/testkit"
)

func giveChat(t *testing.T, db *pgxpool.Pool, user, level string) {
	t.Helper()
	if _, err := db.Exec(context.Background(),
		`INSERT INTO user_app_access (tenant_id, user_id, app, access) VALUES ($1, $2, 'chat', $3)`,
		tenantA, user, level); err != nil {
		t.Fatal(err)
	}
}

func chatChannels(t *testing.T, a *testkit.API, user, app string) []contract.ChatChannel {
	t.Helper()
	resp := a.Request(t, http.MethodGet, "/tenants/tenant-a/chat/channels", app, testkit.Session(a.SignIn(t, user, app)))
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status %d, code %q", resp.StatusCode, code(t, resp))
	}
	var out contract.ChatChannelsOutput
	if err := json.NewDecoder(resp.Body).Decode(&out.Body); err != nil {
		t.Fatal(err)
	}
	return out.Body.Channels
}

// kinds lists a channel list as "kind" or "kind:name", sorted.
func kinds(cs []contract.ChatChannel) []string {
	out := make([]string, len(cs))
	for i, c := range cs {
		out[i] = c.Kind
		if c.Name != "" {
			out[i] += ":" + c.Name
		}
	}
	sort.Strings(out)
	return out
}

func TestChatNeedsAChatLevel(t *testing.T) {
	a := testkit.NewAPI(t, testkit.DB(t), "")
	resp := a.Request(t, http.MethodGet, "/tenants/tenant-a/chat/channels", "seller", testkit.Session(a.SignIn(t, testkit.SellerA, "seller")))
	if resp.StatusCode != http.StatusForbidden || code(t, resp) != "not_allowed" {
		t.Fatalf("status %d", resp.StatusCode)
	}
}

func TestChatChannelsMadeOnceAndFollowStores(t *testing.T) {
	db := testkit.DB(t)
	giveChat(t, db, testkit.SellerA, "member")
	a := testkit.NewAPI(t, db, "")

	first := chatChannels(t, a, testkit.SellerA, "seller")
	want := []string{"general", "personal", "store:A Central", "store:A North"}
	if got := kinds(first); len(got) != len(want) || got[0] != want[0] || got[1] != want[1] || got[2] != want[2] || got[3] != want[3] {
		t.Fatalf("channels %v, want %v", got, want)
	}
	again := chatChannels(t, a, testkit.SellerA, "seller")
	var n int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM chat_channels`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if len(again) != 4 || n != 4 {
		t.Fatalf("made twice: listed %d, stored %d", len(again), n)
	}
	for _, c := range first {
		if c.Kind == "personal" && !c.ReadOnly {
			t.Fatal("Notifications must be read only")
		}
	}
}

func TestChatLevelChangesNoOtherApp(t *testing.T) {
	db := testkit.DB(t)
	// Seller A has no level rows: users.role decides seller. A chat row must not change that.
	giveChat(t, db, testkit.SellerA, "member")
	a := testkit.NewAPI(t, db, "")
	me := getMe(t, a, testkit.SellerA, "seller")
	if acc := me.Tenants[0].Access; acc.Seller != "member" || acc.Chat != "member" {
		t.Fatalf("access %+v", acc)
	}
}

func TestChatAdminChannelOnlyForAdmins(t *testing.T) {
	db := testkit.DB(t)
	giveChat(t, db, testkit.SellerA, "member")
	giveChat(t, db, testkit.AdminA, "admin")
	a := testkit.NewAPI(t, db, "")

	admin := chatChannels(t, a, testkit.AdminA, "backoffice")
	var adminID string
	for _, c := range admin {
		if c.Kind == "admin" {
			adminID = c.ID
		}
	}
	if adminID == "" {
		t.Fatalf("no admin channel: %v", kinds(admin))
	}
	if got := kinds(chatChannels(t, a, testkit.SellerA, "seller")); len(got) != 4 {
		t.Fatalf("seller sees %v", got)
	}
	// Not theirs: answers as if it did not exist.
	resp := a.Request(t, http.MethodGet, "/tenants/tenant-a/chat/channels/"+adminID, "seller", testkit.Session(a.SignIn(t, testkit.SellerA, "seller")))
	if resp.StatusCode != http.StatusNotFound || code(t, resp) != "channel_not_found" {
		t.Fatalf("status %d", resp.StatusCode)
	}
}

func TestChatOwnerIsAlwaysAdmin(t *testing.T) {
	db := testkit.DB(t)
	if _, err := db.Exec(context.Background(), `UPDATE tenants SET owner_id = $1 WHERE id = $2`, testkit.AdminA, tenantA); err != nil {
		t.Fatal(err)
	}
	a := testkit.NewAPI(t, db, "")
	got := kinds(chatChannels(t, a, testkit.AdminA, "backoffice"))
	want := []string{"admin", "general", "personal", "store:A North"}
	if len(got) != len(want) || got[0] != want[0] || got[3] != want[3] {
		t.Fatalf("owner sees %v", got)
	}
}

func TestChatMembers(t *testing.T) {
	db := testkit.DB(t)
	giveChat(t, db, testkit.SellerA, "member")
	giveChat(t, db, testkit.AdminA, "admin")
	a := testkit.NewAPI(t, db, "")
	var central string
	for _, c := range chatChannels(t, a, testkit.SellerA, "seller") {
		if c.Name == "A Central" {
			central = c.ID
		}
	}
	resp := a.Request(t, http.MethodGet, "/tenants/tenant-a/chat/channels/"+central, "seller", testkit.Session(a.SignIn(t, testkit.SellerA, "seller")))
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status %d", resp.StatusCode)
	}
	var out contract.ChatChannelOutput
	if err := json.NewDecoder(resp.Body).Decode(&out.Body); err != nil {
		t.Fatal(err)
	}
	// Admin A has chat but does not work Central: a store's chat is whoever works it.
	if len(out.Body.Members) != 1 || out.Body.Members[0].Name != "Seller A" {
		t.Fatalf("members %+v", out.Body.Members)
	}
}
