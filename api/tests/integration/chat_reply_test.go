//go:build integration

package integration

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/tests/testkit"
)

func reply(t *testing.T, a *testkit.API, user, app, channel, body, to, key string) (*http.Response, contract.ChatMessage) {
	t.Helper()
	resp := a.Send(t, http.MethodPost, "/tenants/tenant-a/chat/channels/"+channel+"/messages", app,
		`{"body":`+string(must(json.Marshal(body)))+`,"replyTo":"`+to+`"}`, []string{"Idempotency-Key: " + key}, testkit.Session(a.SignIn(t, user, app)))
	var m contract.ChatMessage
	if resp.StatusCode == http.StatusOK {
		if err := json.NewDecoder(resp.Body).Decode(&m); err != nil {
			t.Fatal(err)
		}
	}
	return resp, m
}

func activity(t *testing.T, a *testkit.API, user, app string) contract.ChatActivityOutput {
	t.Helper()
	resp := a.Request(t, http.MethodGet, "/tenants/tenant-a/chat/activity", app, testkit.Session(a.SignIn(t, user, app)))
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("activity: status %d, code %q", resp.StatusCode, code(t, resp))
	}
	var out contract.ChatActivityOutput
	if err := json.NewDecoder(resp.Body).Decode(&out.Body); err != nil {
		t.Fatal(err)
	}
	return out
}

func deleteMessage(t *testing.T, a *testkit.API, user, app, channel, id string) *http.Response {
	t.Helper()
	return a.Send(t, http.MethodDelete, "/tenants/tenant-a/chat/channels/"+channel+"/messages/"+id, app, "", nil, testkit.Session(a.SignIn(t, user, app)))
}

func TestChatReplyDeleteAndActivity(t *testing.T) {
	db := testkit.DB(t)
	giveChat(t, db, testkit.SellerA, "member")
	giveChat(t, db, testkit.GuestA, "member")
	giveChat(t, db, testkit.AdminA, "admin")
	a := testkit.NewAPI(t, db, "")
	general := channelOf(t, a, testkit.SellerA, "seller", "general", "")
	admin := channelOf(t, a, testkit.AdminA, "backoffice", "admin", "")

	_, root := post(t, a, testkit.SellerA, "seller", general, "Gelas habis", "key-00000001")
	resp, answer := reply(t, a, testkit.GuestA, "seller", general, "Dikirim jam 9", root.ID, "key-00000002")
	if resp.StatusCode != http.StatusOK || answer.ReplyTo == nil || answer.ReplyTo.ID != root.ID {
		t.Fatalf("reply: %d %+v", resp.StatusCode, answer.ReplyTo)
	}
	got := messages(t, a, testkit.SellerA, "seller", general, "")
	if q := got[0].ReplyTo; q == nil || q.Author != "Seller A" || q.Body != "Gelas habis" {
		t.Fatalf("quote: %+v", q)
	}

	// A reply answers a message of its own channel, never one elsewhere.
	if resp, _ := reply(t, a, testkit.AdminA, "backoffice", admin, "hm", root.ID, "key-00000003"); resp.StatusCode != http.StatusNotFound || code(t, resp) != "message_not_found" {
		t.Fatalf("other channel: %d", resp.StatusCode)
	}

	// Seller A sees Guest A's reply in Activity, unread; Guest A does not see their own.
	act := activity(t, a, testkit.SellerA, "seller")
	if len(act.Body.Items) != 1 || act.Body.Items[0].ID != answer.ID || !act.Body.Items[0].Unread || act.Body.Unread != 1 || act.Body.Items[0].ChannelID != general {
		t.Fatalf("activity: %+v", act.Body)
	}
	if act := activity(t, a, testkit.GuestA, "seller"); len(act.Body.Items) != 0 {
		t.Fatalf("guest's activity: %+v", act.Body.Items)
	}

	// Only the author or a chat admin deletes.
	if resp := deleteMessage(t, a, testkit.GuestA, "seller", general, root.ID); resp.StatusCode != http.StatusForbidden || code(t, resp) != "not_your_message" {
		t.Fatalf("not theirs: %d", resp.StatusCode)
	}
	time.Sleep(10 * time.Millisecond)
	if resp := deleteMessage(t, a, testkit.AdminA, "backoffice", general, root.ID); resp.StatusCode != http.StatusNoContent {
		t.Fatalf("admin delete: %d", resp.StatusCode)
	}
	// Twice is harmless.
	if resp := deleteMessage(t, a, testkit.SellerA, "seller", general, root.ID); resp.StatusCode != http.StatusNoContent {
		t.Fatalf("again: %d", resp.StatusCode)
	}
	got = messages(t, a, testkit.GuestA, "seller", general, "")
	if !got[1].Deleted || got[1].Body != "" || got[0].ReplyTo == nil || !got[0].ReplyTo.Deleted || got[0].ReplyTo.Body != "" {
		t.Fatalf("deleted: %+v / %+v", got[1], got[0].ReplyTo)
	}
	// A phone holding both hears of the deletion through since.
	since := messages(t, a, testkit.GuestA, "seller", general, "?since="+answer.At)
	if len(since) != 1 || since[0].ID != root.ID || !since[0].Deleted {
		t.Fatalf("since: %+v", since)
	}
}
