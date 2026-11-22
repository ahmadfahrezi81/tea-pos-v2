//go:build integration

package integration

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/tests/testkit"
)

func send(t *testing.T, a *testkit.API, user, app, method, path, body string) *http.Response {
	t.Helper()
	return a.Send(t, method, path, app, body, []string{"Idempotency-Key: " + key(user+method+path+body)}, testkit.Session(a.SignIn(t, user, app)))
}

func key(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:16])
}

func makeGroup(t *testing.T, a *testkit.API, name string, members ...string) string {
	t.Helper()
	resp := send(t, a, testkit.AdminA, "backoffice", http.MethodPost, "/tenants/tenant-a/chat/groups",
		`{"name":`+string(must(json.Marshal(name)))+`,"members":`+string(must(json.Marshal(members)))+`}`)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("make group: status %d, code %q", resp.StatusCode, code(t, resp))
	}
	var out contract.ChatGroupOutput
	if err := json.NewDecoder(resp.Body).Decode(&out.Body); err != nil {
		t.Fatal(err)
	}
	return out.Body.ID
}

func channelByID(cs []contract.ChatChannel, id string) *contract.ChatChannel {
	for i := range cs {
		if cs[i].ID == id {
			return &cs[i]
		}
	}
	return nil
}

func TestChatGroups(t *testing.T) {
	db := testkit.DB(t)
	giveChat(t, db, testkit.SellerA, "member")
	giveChat(t, db, testkit.GuestA, "member")
	giveChat(t, db, testkit.AdminA, "admin")
	a := testkit.NewAPI(t, db, "")

	// Only a chat admin makes one, and it needs a name.
	if resp := send(t, a, testkit.SellerA, "seller", http.MethodPost, "/tenants/tenant-a/chat/groups", `{"name":"Mine","members":[]}`); resp.StatusCode != http.StatusForbidden {
		t.Fatalf("a member made a group: status %d", resp.StatusCode)
	}
	if resp := send(t, a, testkit.AdminA, "backoffice", http.MethodPost, "/tenants/tenant-a/chat/groups", `{"name":"  ","members":[]}`); code(t, resp) != "blank_group_name" {
		t.Fatalf("blank name: status %d", resp.StatusCode)
	}

	office := makeGroup(t, a, "Office", testkit.GuestA)
	if c := channelByID(chatChannels(t, a, testkit.GuestA, "backoffice"), office); c == nil || !c.Mine || c.Kind != "group" || c.Name != "Office" {
		t.Fatalf("Guest A: %+v", c)
	}
	if c := channelByID(chatChannels(t, a, testkit.SellerA, "seller"), office); c != nil {
		t.Fatal("Seller A sees a group they are not in")
	}
	resp := a.Request(t, http.MethodGet, "/tenants/tenant-a/chat/channels/"+office, "seller", testkit.Session(a.SignIn(t, testkit.SellerA, "seller")))
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("Seller A opened it: status %d", resp.StatusCode)
	}

	// The chat admin sees it among Other channels, and follows it by writing there.
	if c := channelByID(chatChannels(t, a, testkit.AdminA, "backoffice"), office); c == nil || c.Mine {
		t.Fatalf("Admin A before writing: %+v", c)
	}
	if resp, _ := post(t, a, testkit.AdminA, "backoffice", office, "Hello office", "key-k1-0000"); resp.StatusCode != http.StatusOK {
		t.Fatalf("admin post: status %d", resp.StatusCode)
	}
	if c := channelByID(chatChannels(t, a, testkit.AdminA, "backoffice"), office); c == nil || !c.Mine || !c.Following {
		t.Fatalf("Admin A after writing: %+v", c)
	}

	// Its people, the whole list: Guest A out, Seller A in.
	if resp := send(t, a, testkit.AdminA, "backoffice", http.MethodPut, "/tenants/tenant-a/chat/groups/"+office+"/members",
		`{"members":["`+testkit.SellerA+`"]}`); resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK {
		t.Fatalf("members: status %d", resp.StatusCode)
	}
	if c := channelByID(chatChannels(t, a, testkit.GuestA, "backoffice"), office); c != nil {
		t.Fatal("Guest A still in it")
	}
	if c := channelByID(chatChannels(t, a, testkit.SellerA, "seller"), office); c == nil || !c.Mine {
		t.Fatalf("Seller A: %+v", c)
	}

	// Renamed, then archived: read only for everyone.
	if resp := send(t, a, testkit.AdminA, "backoffice", http.MethodPatch, "/tenants/tenant-a/chat/groups/"+office, `{"name":"Office team","archived":true}`); resp.StatusCode >= 300 {
		t.Fatalf("archive: status %d", resp.StatusCode)
	}
	if c := channelByID(chatChannels(t, a, testkit.SellerA, "seller"), office); c == nil || c.Name != "Office team" || !c.Archived || !c.ReadOnly {
		t.Fatalf("after archive: %+v", c)
	}
	if resp, _ := post(t, a, testkit.SellerA, "seller", office, "Still here?", "key-k2-0000"); code(t, resp) != "channel_read_only" {
		t.Fatalf("posted in an archived group: status %d", resp.StatusCode)
	}
}

func TestChatFollow(t *testing.T) {
	db := testkit.DB(t)
	giveChat(t, db, testkit.SellerA, "member")
	giveChat(t, db, testkit.AdminA, "admin")
	a := testkit.NewAPI(t, db, "")
	// Admin A does not work A Central: an Other channel for them.
	central := channelOf(t, a, testkit.SellerA, "seller", "store", "A Central")
	if c := channelByID(chatChannels(t, a, testkit.AdminA, "backoffice"), central); c == nil || c.Mine {
		t.Fatalf("Admin A: %+v", c)
	}
	post(t, a, testkit.SellerA, "seller", central, "Before the follow", "key-f1-0000")
	if n := activityUnread(t, a, testkit.AdminA); n != 0 {
		t.Fatalf("activity before following: %d", n)
	}

	// A member cannot follow; following counts from now.
	if resp := send(t, a, testkit.SellerA, "seller", http.MethodPut, "/tenants/tenant-a/chat/channels/"+central+"/follow", ""); resp.StatusCode != http.StatusForbidden {
		t.Fatalf("member followed: status %d", resp.StatusCode)
	}
	if resp := send(t, a, testkit.AdminA, "backoffice", http.MethodPut, "/tenants/tenant-a/chat/channels/"+central+"/follow", ""); resp.StatusCode != http.StatusNoContent {
		t.Fatalf("follow: status %d", resp.StatusCode)
	}
	if c := channelByID(chatChannels(t, a, testkit.AdminA, "backoffice"), central); c == nil || !c.Mine || !c.Following || c.Unread != 0 {
		t.Fatalf("after follow: %+v", c)
	}
	post(t, a, testkit.SellerA, "seller", central, "After the follow", "key-f2-0000")
	if c := channelByID(chatChannels(t, a, testkit.AdminA, "backoffice"), central); c.Unread != 1 {
		t.Fatalf("unread %d", c.Unread)
	}
	if n := activityUnread(t, a, testkit.AdminA); n != 1 {
		t.Fatalf("activity after following: %d", n)
	}

	// Told of it as a follower, not listed as one of its people.
	resp := a.Request(t, http.MethodGet, "/tenants/tenant-a/chat/channels/"+central, "seller", testkit.Session(a.SignIn(t, testkit.SellerA, "seller")))
	var out contract.ChatChannelOutput
	if err := json.NewDecoder(resp.Body).Decode(&out.Body); err != nil {
		t.Fatal(err)
	}
	followers := 0
	for _, m := range out.Body.Members {
		if m.Follower {
			followers++
			if m.ID != testkit.AdminA {
				t.Fatalf("follower %s", m.Name)
			}
		}
	}
	if followers != 1 {
		t.Fatalf("members %+v", out.Body.Members)
	}

	if resp := send(t, a, testkit.AdminA, "backoffice", http.MethodDelete, "/tenants/tenant-a/chat/channels/"+central+"/follow", ""); resp.StatusCode != http.StatusNoContent {
		t.Fatalf("unfollow: status %d", resp.StatusCode)
	}
	if c := channelByID(chatChannels(t, a, testkit.AdminA, "backoffice"), central); c.Mine {
		t.Fatal("still following")
	}

	// Never someone's Notifications.
	personal := channelOf(t, a, testkit.SellerA, "seller", "personal", "")
	resp = a.Request(t, http.MethodGet, "/tenants/tenant-a/chat/channels/"+personal, "backoffice", testkit.Session(a.SignIn(t, testkit.AdminA, "backoffice")))
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("admin opened someone's Notifications: status %d", resp.StatusCode)
	}
}

func TestUacChatGroups(t *testing.T) {
	db := testkit.DB(t)
	giveChat(t, db, testkit.SellerA, "member")
	giveChat(t, db, testkit.AdminA, "admin")
	a := testkit.NewAPI(t, db, "")
	office := makeGroup(t, a, "Office")
	path := "/tenants/tenant-a/uac/people/" + testkit.SellerA + "/chat-groups"

	resp := send(t, a, testkit.AdminA, "backoffice", http.MethodPut, path, `{"groups":["`+office+`"]}`)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("set: status %d, code %q", resp.StatusCode, code(t, resp))
	}
	var out contract.UserChatGroupsOutput
	if err := json.NewDecoder(resp.Body).Decode(&out.Body); err != nil {
		t.Fatal(err)
	}
	if len(out.Body.Groups) != 1 || !out.Body.Groups[0].Member {
		t.Fatalf("groups %+v", out.Body.Groups)
	}
	if c := channelByID(chatChannels(t, a, testkit.SellerA, "seller"), office); c == nil || !c.Mine {
		t.Fatalf("Seller A: %+v", c)
	}
	// A seller cannot set anyone's groups.
	if resp := send(t, a, testkit.SellerA, "seller", http.MethodPut, path, `{"groups":[]}`); resp.StatusCode != http.StatusForbidden {
		t.Fatalf("seller set groups: status %d", resp.StatusCode)
	}
}

func activityUnread(t *testing.T, a *testkit.API, user string) int {
	t.Helper()
	resp := a.Request(t, http.MethodGet, "/tenants/tenant-a/chat/activity", "backoffice", testkit.Session(a.SignIn(t, user, "backoffice")))
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("activity: status %d", resp.StatusCode)
	}
	var out contract.ChatActivityOutput
	if err := json.NewDecoder(resp.Body).Decode(&out.Body); err != nil {
		t.Fatal(err)
	}
	return out.Body.Unread
}
