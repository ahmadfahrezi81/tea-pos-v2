// Package push sends Web Push notifications (VAPID, RFC 8291) to the phones that subscribed:
// from the worker only, never in a request. A push is a nudge; the row it points at is the truth.
package push

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	webpush "github.com/SherClockHolmes/webpush-go"
)

// Sender holds the VAPID keys; nil (keys not set) sends nothing.
type Sender struct {
	Public, Private, Subject string
}

// New is a Sender, or nil when the keys are not set (a laptop, or before they are made).
func New(public, private, subject string) *Sender {
	if public == "" || private == "" {
		return nil
	}
	return &Sender{Public: public, Private: private, Subject: subject}
}

// Subscription is one phone, as its browser gave it.
type Subscription struct {
	Endpoint, P256dh, Auth string
}

// Message is what the phone's service worker shows. Tag groups a channel's notifications into
// one line that updates; URL is where a tap goes.
type Message struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	Tag   string `json:"tag"`
	URL   string `json:"url"`
	// Icon: the sender's photo where the phone shows one (Android); else the app's icon.
	Icon string `json:"icon,omitempty"`
}

// ErrGone: the phone dropped this subscription (404 or 410); delete it.
var ErrGone = errors.New("push subscription gone")

// Send pushes m to one phone. topic replaces an undelivered push with the same topic at the push
// service, so a phone that was off gets the latest, not fifteen.
func (s *Sender) Send(ctx context.Context, sub Subscription, m Message, topic string) error {
	if s == nil {
		return nil
	}
	body, err := json.Marshal(m)
	if err != nil {
		return err
	}
	resp, err := webpush.SendNotificationWithContext(ctx, body, &webpush.Subscription{
		Endpoint: sub.Endpoint,
		Keys:     webpush.Keys{P256dh: sub.P256dh, Auth: sub.Auth},
	}, &webpush.Options{
		Subscriber:      s.Subject,
		VAPIDPublicKey:  s.Public,
		VAPIDPrivateKey: s.Private,
		TTL:             24 * 60 * 60,
		Urgency:         webpush.UrgencyHigh,
		Topic:           strings.ReplaceAll(topic, "-", ""),
	})
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, resp.Body)
	switch {
	case resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusGone:
		return ErrGone
	case resp.StatusCode >= 300:
		return errors.New("push service: " + resp.Status)
	}
	return nil
}
