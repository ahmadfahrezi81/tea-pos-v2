//go:build integration

package integration

import (
	"context"
	"net/http"
	"net/url"
	"testing"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/tests/testkit"
)

func react(t *testing.T, a *testkit.API, method, user, channel, message, emoji string) *http.Response {
	t.Helper()
	return a.Send(t, method, "/tenants/tenant-a/chat/channels/"+channel+"/messages/"+message+"/reactions/"+url.PathEscape(emoji),
		"seller", "", nil, testkit.Session(a.SignIn(t, user, "seller")))
}

func TestChatReactions(t *testing.T) {
	db := testkit.DB(t)
	giveChat(t, db, testkit.SellerA, "member")
	giveChat(t, db, testkit.GuestA, "member")
	a := testkit.NewAPI(t, db, "")
	general := channelOf(t, a, testkit.SellerA, "seller", "general", "")
	_, m := post(t, a, testkit.SellerA, "seller", general, "Gelas habis", "key-00000001")

	for range 2 {
		if resp := react(t, a, http.MethodPut, testkit.GuestA, general, m.ID, "❤️"); resp.StatusCode != http.StatusNoContent {
			t.Fatalf("react: %d", resp.StatusCode)
		}
	}
	react(t, a, http.MethodPut, testkit.SellerA, general, m.ID, "❤️")
	got := messages(t, a, testkit.SellerA, "seller", general, "")
	if r := got[0].Reactions; len(r) != 1 || r[0].Emoji != "❤️" || len(r[0].Names) != 2 || !r[0].Mine {
		t.Fatalf("reactions: %+v", r)
	}
	// A reaction brings the message back to a phone catching up.
	if since := messages(t, a, testkit.GuestA, "seller", general, "?since="+m.At); len(since) != 1 {
		t.Fatalf("since: %+v", since)
	}
	react(t, a, http.MethodDelete, testkit.GuestA, general, m.ID, "❤️")
	if r := messages(t, a, testkit.GuestA, "seller", general, "")[0].Reactions; len(r) != 1 || len(r[0].Names) != 1 || r[0].Mine {
		t.Fatalf("after taking back: %+v", r)
	}
	if resp := react(t, a, http.MethodPut, testkit.GuestA, general, m.ID, "🔥"); resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("not one of the six: %d", resp.StatusCode)
	}
	// Not in the channel: as if it did not exist.
	admin := channelOf(t, a, testkit.SellerA, "seller", "personal", "")
	if resp := react(t, a, http.MethodPut, testkit.GuestA, admin, m.ID, "👍"); resp.StatusCode != http.StatusNotFound {
		t.Fatalf("someone else's inbox: %d", resp.StatusCode)
	}
}

func TestChatEdit(t *testing.T) {
	db := testkit.DB(t)
	giveChat(t, db, testkit.SellerA, "member")
	giveChat(t, db, testkit.GuestA, "member")
	a := testkit.NewAPI(t, db, "")
	general := channelOf(t, a, testkit.SellerA, "seller", "general", "")
	_, m := post(t, a, testkit.SellerA, "seller", general, "Gelas habis", "key-00000001")
	edit := func(user, body string) *http.Response {
		return a.Send(t, http.MethodPatch, "/tenants/tenant-a/chat/channels/"+general+"/messages/"+m.ID, "seller",
			`{"body":"`+body+`"}`, nil, testkit.Session(a.SignIn(t, user, "seller")))
	}
	if resp := edit(testkit.GuestA, "mine now"); resp.StatusCode != http.StatusForbidden || code(t, resp) != "not_author" {
		t.Fatalf("someone else's: %d", resp.StatusCode)
	}
	if resp := edit(testkit.SellerA, "Gelas habis, 2 dus"); resp.StatusCode != http.StatusOK {
		t.Fatalf("edit: %d", resp.StatusCode)
	}
	got := messages(t, a, testkit.GuestA, "seller", general, "")[0]
	if got.Body != "Gelas habis, 2 dus" || got.EditedAt == "" {
		t.Fatalf("edited: %+v", got)
	}
	if _, err := db.Exec(context.Background(), `UPDATE chat_messages SET created_at = now() - interval '16 minutes' WHERE id = $1`, m.ID); err != nil {
		t.Fatal(err)
	}
	if resp := edit(testkit.SellerA, "too late"); resp.StatusCode != http.StatusUnprocessableEntity || code(t, resp) != "edit_closed" {
		t.Fatalf("after 15 minutes: %d", resp.StatusCode)
	}
}

func TestChatMentionInActivity(t *testing.T) {
	db := testkit.DB(t)
	giveChat(t, db, testkit.SellerA, "member")
	giveChat(t, db, testkit.GuestA, "member")
	a := testkit.NewAPI(t, db, "")
	general := channelOf(t, a, testkit.SellerA, "seller", "general", "")
	post(t, a, testkit.SellerA, "seller", general, "@Guest A tolong kirim", "key-00000001")
	post(t, a, testkit.SellerA, "seller", general, "tanpa nama", "key-00000002")
	items := activity(t, a, testkit.GuestA, "seller").Body.Items
	if len(items) != 2 || items[0].MentionsMe || !items[1].MentionsMe {
		t.Fatalf("activity: %+v", items)
	}
}

// One app per phone: Tea-POS and Tea-Office both subscribed on one phone, the push goes only to
// the one used last.
func TestChatPushOneAppPerPhone(t *testing.T) {
	db := testkit.DB(t)
	giveChat(t, db, testkit.SellerA, "member")
	giveChat(t, db, testkit.AdminA, "member")
	a := testkit.NewAPI(t, db, "")
	general := channelOf(t, a, testkit.SellerA, "seller", "general", "")
	a.SignIn(t, testkit.AdminA, "seller")
	a.SignIn(t, testkit.AdminA, "backoffice")
	ctx := context.Background()
	for _, s := range [][2]string{{"seller", "https://push.example/pos"}, {"backoffice", "https://push.example/office"}} {
		if _, err := db.Exec(ctx, `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, app) VALUES ($1, $2, 'k', 'a', 'iPhone', $3)`,
			testkit.AdminA, s[1], s[0]); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := db.Exec(ctx, `UPDATE sessions SET last_seen_at = now() - interval '1 hour' WHERE user_id = $1 AND app = 'seller'`, testkit.AdminA); err != nil {
		t.Fatal(err)
	}
	_, m := post(t, a, testkit.SellerA, "seller", general, "hi", "key-00000001")
	var ch, author pgtype.UUID
	_ = ch.Scan(general)
	_ = author.Scan(testkit.SellerA)
	var at pgtype.Timestamptz
	if err := db.QueryRow(ctx, `SELECT created_at FROM chat_messages WHERE id = $1`, m.ID).Scan(&at); err != nil {
		t.Fatal(err)
	}
	targets, err := store.New(db).ChatPushTargets(ctx, store.ChatPushTargetsParams{ChannelID: ch, AuthorID: author, At: at})
	if err != nil {
		t.Fatal(err)
	}
	if len(targets) != 1 || targets[0].Endpoint != "https://push.example/office" {
		t.Fatalf("targets: %+v", targets)
	}
}
