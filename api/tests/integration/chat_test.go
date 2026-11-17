//go:build integration

package integration

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"sort"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
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
	if len(out.Body.Members) != 1 || out.Body.Members[0].Name != "Seller A" || out.Body.Members[0].Admin {
		t.Fatalf("members %+v", out.Body.Members)
	}
	// In General, the chat admin wears the badge and the member does not.
	general := channelOf(t, a, testkit.SellerA, "seller", "general", "")
	resp = a.Request(t, http.MethodGet, "/tenants/tenant-a/chat/channels/"+general, "seller", testkit.Session(a.SignIn(t, testkit.SellerA, "seller")))
	out = contract.ChatChannelOutput{}
	if err := json.NewDecoder(resp.Body).Decode(&out.Body); err != nil {
		t.Fatal(err)
	}
	admins := map[string]bool{}
	for _, m := range out.Body.Members {
		admins[m.ID] = m.Admin
	}
	if !admins[testkit.AdminA] || admins[testkit.SellerA] {
		t.Fatalf("admins %+v", admins)
	}
}

// channelOf is one of user's channels by kind (and name, for a store's).
func channelOf(t *testing.T, a *testkit.API, user, app, kind, name string) string {
	t.Helper()
	for _, c := range chatChannels(t, a, user, app) {
		if c.Kind == kind && c.Name == name {
			return c.ID
		}
	}
	t.Fatalf("no %s %q", kind, name)
	return ""
}

func post(t *testing.T, a *testkit.API, user, app, channel, body, key string) (*http.Response, contract.ChatMessage) {
	t.Helper()
	resp := a.Send(t, http.MethodPost, "/tenants/tenant-a/chat/channels/"+channel+"/messages", app,
		`{"body":`+string(must(json.Marshal(body)))+`}`, []string{"Idempotency-Key: " + key}, testkit.Session(a.SignIn(t, user, app)))
	var m contract.ChatMessage
	if resp.StatusCode == http.StatusOK {
		if err := json.NewDecoder(resp.Body).Decode(&m); err != nil {
			t.Fatal(err)
		}
	}
	return resp, m
}

func must(b []byte, err error) []byte {
	if err != nil {
		panic(err)
	}
	return b
}

func messages(t *testing.T, a *testkit.API, user, app, channel, query string) []contract.ChatMessage {
	t.Helper()
	resp := a.Request(t, http.MethodGet, "/tenants/tenant-a/chat/channels/"+channel+"/messages"+query, app, testkit.Session(a.SignIn(t, user, app)))
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status %d, code %q", resp.StatusCode, code(t, resp))
	}
	var out contract.ChatMessagesOutput
	if err := json.NewDecoder(resp.Body).Decode(&out.Body); err != nil {
		t.Fatal(err)
	}
	return out.Body.Items
}

func TestChatPostAndRead(t *testing.T) {
	db := testkit.DB(t)
	giveChat(t, db, testkit.SellerA, "member")
	giveChat(t, db, testkit.GuestA, "member")
	a := testkit.NewAPI(t, db, "")
	general := channelOf(t, a, testkit.SellerA, "seller", "general", "")

	resp, first := post(t, a, testkit.SellerA, "seller", general, "  Gelas habis  ", "key-00000001")
	if resp.StatusCode != http.StatusOK || first.Body != "Gelas habis" || first.ClientKey != "key-00000001" || first.Author != "Seller A" {
		t.Fatalf("status %d, %+v", resp.StatusCode, first)
	}
	// The same key never posts twice.
	if resp, again := post(t, a, testkit.SellerA, "seller", general, "  Gelas habis  ", "key-00000001"); resp.StatusCode != http.StatusOK || again.ID != first.ID {
		t.Fatalf("again: %d %s", resp.StatusCode, again.ID)
	}
	_, second := post(t, a, testkit.SellerA, "seller", general, "Dikirim jam 9", "key-00000002")

	got := messages(t, a, testkit.GuestA, "seller", general, "")
	if len(got) != 2 || got[0].ID != second.ID || got[1].ID != first.ID {
		t.Fatalf("page: %+v", got)
	}
	since := messages(t, a, testkit.GuestA, "seller", general, "?since="+first.At)
	if len(since) != 1 || since[0].ID != second.ID {
		t.Fatalf("since: %+v", since)
	}

	// Guest A has two unread; reading moves them to none, and Seen by counts them.
	var unread int
	for _, c := range chatChannels(t, a, testkit.GuestA, "seller") {
		if c.ID == general {
			unread = c.Unread
		}
	}
	if unread != 2 {
		t.Fatalf("unread %d", unread)
	}
	read := a.Send(t, http.MethodPost, "/tenants/tenant-a/chat/channels/"+general+"/read", "seller",
		`{"at":"`+second.At+`"}`, nil, testkit.Session(a.SignIn(t, testkit.GuestA, "seller")))
	if read.StatusCode != http.StatusNoContent {
		t.Fatalf("read %d", read.StatusCode)
	}
	for _, c := range chatChannels(t, a, testkit.GuestA, "seller") {
		if c.ID == general && c.Unread != 0 {
			t.Fatalf("still unread %d", c.Unread)
		}
	}
	resp = a.Request(t, http.MethodGet, "/tenants/tenant-a/chat/channels/"+general, "seller", testkit.Session(a.SignIn(t, testkit.SellerA, "seller")))
	var ch contract.ChatChannelOutput
	if err := json.NewDecoder(resp.Body).Decode(&ch.Body); err != nil {
		t.Fatal(err)
	}
	for _, m := range ch.Body.Members {
		if m.Name == "Guest A" && m.ReadAt < second.At {
			t.Fatalf("guest read %q, want %q", m.ReadAt, second.At)
		}
	}
}

func TestChatReadOnlyAndNotMine(t *testing.T) {
	db := testkit.DB(t)
	giveChat(t, db, testkit.SellerA, "member")
	giveChat(t, db, testkit.AdminA, "admin")
	a := testkit.NewAPI(t, db, "")
	inbox := channelOf(t, a, testkit.SellerA, "seller", "personal", "")
	if resp, _ := post(t, a, testkit.SellerA, "seller", inbox, "hi", "key-00000001"); resp.StatusCode != http.StatusForbidden || code(t, resp) != "channel_read_only" {
		t.Fatalf("inbox: %d", resp.StatusCode)
	}
	admin := channelOf(t, a, testkit.AdminA, "backoffice", "admin", "")
	if resp, _ := post(t, a, testkit.SellerA, "seller", admin, "hi", "key-00000002"); resp.StatusCode != http.StatusNotFound {
		t.Fatalf("admin channel: %d", resp.StatusCode)
	}
	// Someone else's inbox is not theirs either.
	adminInbox := channelOf(t, a, testkit.AdminA, "backoffice", "personal", "")
	resp := a.Request(t, http.MethodGet, "/tenants/tenant-a/chat/channels/"+adminInbox+"/messages", "seller", testkit.Session(a.SignIn(t, testkit.SellerA, "seller")))
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("their inbox: %d", resp.StatusCode)
	}
}

func TestChatPhotos(t *testing.T) {
	db := testkit.DB(t)
	giveChat(t, db, testkit.SellerA, "member")
	a := testkit.NewAPI(t, db, "")
	general := channelOf(t, a, testkit.SellerA, "seller", "general", "")
	send := func(key, photos string) *http.Response {
		return a.Send(t, http.MethodPost, "/tenants/tenant-a/chat/channels/"+general+"/messages", "seller",
			`{"body":"","photos":`+photos+`}`, []string{"Idempotency-Key: " + key}, testkit.Session(a.SignIn(t, testkit.SellerA, "seller")))
	}
	own := tenantA + "/x/"
	if resp := send("key-00000001", `[{"path":"`+own+`a.webp","previewPath":"`+own+`a-s.webp","width":1080,"height":810},{"path":"`+own+`b.webp","previewPath":"`+own+`b-s.webp","width":810,"height":1080}]`); resp.StatusCode != http.StatusOK {
		t.Fatalf("photos: %d %s", resp.StatusCode, code(t, resp))
	}
	// Someone else's folder is refused.
	if resp := send("key-00000002", `[{"path":"00000000-0000-0000-0000-00000000000b/a.webp","previewPath":"`+own+`a-s.webp","width":1,"height":1}]`); resp.StatusCode != http.StatusUnprocessableEntity {
		t.Fatalf("other tenant's photo: %d", resp.StatusCode)
	}
	got := messages(t, a, testkit.SellerA, "seller", general, "")
	if len(got) != 1 || len(got[0].Photos) != 2 || got[0].Photos[0].Width != 1080 || got[0].Photos[1].Height != 1080 {
		t.Fatalf("messages: %+v", got)
	}
}

func TestChatPushQueuedOncePerBurst(t *testing.T) {
	db := testkit.DB(t)
	giveChat(t, db, testkit.SellerA, "member")
	a := testkit.NewAPI(t, db, "")
	general := channelOf(t, a, testkit.SellerA, "seller", "general", "")
	post(t, a, testkit.SellerA, "seller", general, "one", "key-00000001")
	post(t, a, testkit.SellerA, "seller", general, "two", "key-00000002")
	var n int
	if err := db.QueryRow(context.Background(),
		`SELECT count(*) FROM river.river_job WHERE kind = 'chat_push' AND args->>'channel_id' = $1`, general).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("%d push jobs, want 1", n)
	}
}

// Two push jobs for one burst (River's 10 s rule is a time bucket, so messages either side of
// its edge get one each): only the first to claim the newest message sends it.
func TestChatPushClaimedOnce(t *testing.T) {
	db := testkit.DB(t)
	giveChat(t, db, testkit.SellerA, "member")
	a := testkit.NewAPI(t, db, "")
	general := channelOf(t, a, testkit.SellerA, "seller", "general", "")
	_, m := post(t, a, testkit.SellerA, "seller", general, "hi", "key-00000001")
	q := store.New(db)
	var ch, msg pgtype.UUID
	_ = ch.Scan(general)
	_ = msg.Scan(m.ID)
	ctx := context.Background()
	if _, err := q.ClaimChatPush(ctx, store.ClaimChatPushParams{MessageID: msg, ChannelID: ch}); err != nil {
		t.Fatalf("first claim: %v", err)
	}
	if _, err := q.ClaimChatPush(ctx, store.ClaimChatPushParams{MessageID: msg, ChannelID: ch}); !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("second claim: %v, want no rows", err)
	}
}

func TestPushSubscription(t *testing.T) {
	db := testkit.DB(t)
	a := testkit.NewAPI(t, db, "")
	seller := testkit.Session(a.SignIn(t, testkit.SellerA, "seller"))
	sub := `{"endpoint":"https://push.example/abc","p256dh":"key","auth":"secret"}`
	for range 2 {
		if resp := a.Send(t, http.MethodPut, "/push/subscription", "seller", sub, nil, seller); resp.StatusCode != http.StatusNoContent {
			t.Fatalf("subscribe %d", resp.StatusCode)
		}
	}
	if n := count(t, db, `SELECT count(*) FROM push_subscriptions`); n != 1 {
		t.Fatalf("%d rows", n)
	}
	if resp := a.Send(t, http.MethodPost, "/push/subscription/off", "seller", `{"endpoint":"https://push.example/abc"}`, nil, seller); resp.StatusCode != http.StatusNoContent {
		t.Fatalf("off %d", resp.StatusCode)
	}
	if n := count(t, db, `SELECT count(*) FROM push_subscriptions`); n != 0 {
		t.Fatalf("%d rows after off", n)
	}
}

func TestChatTyping(t *testing.T) {
	db := testkit.DB(t)
	giveChat(t, db, testkit.SellerA, "member")
	giveChat(t, db, testkit.AdminA, "admin")
	url := testkit.NewRealtime(t, db)
	a := testkit.NewAPI(t, db, "")
	general := channelOf(t, a, testkit.SellerA, "seller", "general", "")
	channelOf(t, a, testkit.AdminA, "backoffice", "general", "")

	adminToken := a.SignIn(t, testkit.AdminA, "backoffice")
	admin, _, err := dial(t, url, "backoffice", adminToken)
	if err != nil {
		t.Fatal(err)
	}
	subscribe(t, admin, "user:"+testkit.AdminA)
	sellerToken := a.SignIn(t, testkit.SellerA, "seller")
	seller, _, err := dial(t, url, "seller", sellerToken)
	if err != nil {
		t.Fatal(err)
	}
	subscribe(t, seller, "user:"+testkit.SellerA)

	typing := func(app, token, channel string) *http.Response {
		return a.Request(t, http.MethodPost, "/tenants/tenant-a/chat/channels/"+channel+"/typing", app, testkit.Session(token))
	}
	if resp := typing("seller", sellerToken, general); resp.StatusCode != http.StatusNoContent {
		t.Fatalf("typing: %d", resp.StatusCode)
	}
	if m := next(t, admin, 2*time.Second); m["kind"] != "chat_typing" || m["id"] != general || m["by"] != testkit.SellerA {
		t.Fatalf("the other member: %v", m)
	}
	if m := next(t, seller, 300*time.Millisecond); m != nil {
		t.Fatalf("the typer heard themselves: %v", m)
	}
	inbox := channelOf(t, a, testkit.SellerA, "seller", "personal", "")
	if resp := typing("seller", sellerToken, inbox); resp.StatusCode != http.StatusForbidden {
		t.Fatalf("inbox: %d", resp.StatusCode)
	}
}
