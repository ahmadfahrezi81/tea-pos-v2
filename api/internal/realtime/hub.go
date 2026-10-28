package realtime

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/coder/websocket"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/auth"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/httpx"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/middleware"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
)

const (
	// PingEvery keeps a socket alive: Cloudflare drops one idle for about 100 seconds.
	PingEvery   = 30 * time.Second
	pingTimeout = 10 * time.Second
	// maxTopics a socket may watch; a user's tenants and stores are far fewer.
	maxTopics = 100
	// sendBuffer is how many events may wait for a slow phone before it is dropped.
	sendBuffer = 32
)

// Hub holds every socket and the topics each watches.
type Hub struct {
	sessions *auth.Sessions
	q        *store.Queries

	mu      sync.Mutex
	clients map[*client]struct{}
}

type client struct {
	conn    *websocket.Conn
	token   string
	userID  string
	allowed map[string]bool
	send    chan []byte

	mu     sync.Mutex
	topics map[string]bool
}

func NewHub(sessions *auth.Sessions, q *store.Queries) *Hub {
	return &Hub{sessions: sessions, q: q, clients: map[*client]struct{}{}}
}

// Listen hears every Announce and passes it on, until ctx ends. A dropped connection to
// Postgres is reopened, and the phones told to resync, since changes in between were missed.
func (h *Hub) Listen(ctx context.Context, cfg *pgx.ConnConfig) {
	for delay := time.Second; ctx.Err() == nil; delay = min(2*delay, 30*time.Second) {
		err := h.listen(ctx, cfg)
		if ctx.Err() != nil {
			return
		}
		slog.WarnContext(ctx, "realtime: listening stopped, reopening", "err", err, "in", delay)
		select {
		case <-ctx.Done():
			return
		case <-time.After(delay):
		}
		h.broadcast(Event{Kind: Resync})
	}
}

func (h *Hub) listen(ctx context.Context, cfg *pgx.ConnConfig) error {
	conn, err := pgx.ConnectConfig(ctx, cfg)
	if err != nil {
		return err
	}
	defer conn.Close(context.Background())
	if _, err := conn.Exec(ctx, "LISTEN "+Channel); err != nil {
		return err
	}
	slog.InfoContext(ctx, "realtime: listening")
	for {
		n, err := conn.WaitForNotification(ctx)
		if err != nil {
			return err
		}
		var e Event
		if err := json.Unmarshal([]byte(n.Payload), &e); err != nil || e.Topic == "" {
			slog.WarnContext(ctx, "realtime: unreadable notification", "payload", n.Payload)
			continue
		}
		h.dispatch(ctx, e)
	}
}

func (h *Hub) dispatch(ctx context.Context, e Event) {
	if e.Kind == SignedOut {
		h.recheck(ctx, e.Topic)
	}
	msg, _ := json.Marshal(e)
	for _, c := range h.watching(e.Topic) {
		c.push(msg)
	}
}

func (h *Hub) broadcast(e Event) {
	msg, _ := json.Marshal(e)
	h.mu.Lock()
	defer h.mu.Unlock()
	for c := range h.clients {
		c.push(msg)
	}
}

func (h *Hub) watching(topic string) []*client {
	h.mu.Lock()
	defer h.mu.Unlock()
	var out []*client
	for c := range h.clients {
		c.mu.Lock()
		if c.topics[topic] {
			out = append(out, c)
		}
		c.mu.Unlock()
	}
	return out
}

// recheck closes the user's sockets whose session has ended (signed out there, or everywhere).
func (h *Hub) recheck(ctx context.Context, userTopic string) {
	h.mu.Lock()
	var mine []*client
	for c := range h.clients {
		if UserTopic(c.userID) == userTopic {
			mine = append(mine, c)
		}
	}
	h.mu.Unlock()
	for _, c := range mine {
		h.sessions.Forget(c.token)
		if _, _, err := h.sessions.Lookup(ctx, c.token); errors.Is(err, auth.ErrNoSession) {
			go c.conn.Close(websocket.StatusPolicyViolation, "signed out")
		}
	}
}

// CloseAll tells every phone the hub is going away (a deploy), so each reconnects at once
// to the new one instead of waiting for a ping to fail.
func (h *Hub) CloseAll() {
	h.mu.Lock()
	defer h.mu.Unlock()
	for c := range h.clients {
		go c.conn.Close(websocket.StatusGoingAway, "restarting")
	}
}

// push queues msg; a phone too slow to keep up is dropped, and catches up when it reconnects.
// Closing waits for the phone's answer, so it never holds up the others.
func (c *client) push(msg []byte) {
	select {
	case c.send <- msg:
	default:
		go c.conn.Close(websocket.StatusTryAgainLater, "too slow")
	}
}

var (
	errNotSignedIn = httpx.New(http.StatusUnauthorized, "not_signed_in", "Sign in to continue")
	errNotAllowed  = httpx.New(http.StatusForbidden, "not_allowed", "Not allowed")
)

// ServeHTTP is the socket at /realtime: signed in by the app's session cookie (sent with the
// upgrade like any request), through the forwarder only (the edge middleware).
func (h *Hub) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	cookie, err := r.Cookie(auth.CookieName)
	if err != nil || cookie.Value == "" {
		httpx.Write(w, errNotSignedIn)
		return
	}
	session, _, err := h.sessions.Lookup(ctx, cookie.Value)
	if errors.Is(err, auth.ErrNoSession) {
		httpx.Write(w, errNotSignedIn)
		return
	}
	if err != nil {
		slog.ErrorContext(ctx, "realtime: session lookup", "err", err)
		httpx.Write(w, httpx.New(http.StatusInternalServerError, "internal", "Something went wrong"))
		return
	}
	app := middleware.App(ctx)
	if session.App != app || !auth.Allowed(app, session.Role, session.Status, session.Apps) {
		httpx.Write(w, errNotAllowed)
		return
	}
	allowed, err := h.allowedTopics(ctx, session.UserID, app)
	if err != nil {
		slog.ErrorContext(ctx, "realtime: topics", "err", err)
		httpx.Write(w, httpx.New(http.StatusInternalServerError, "internal", "Something went wrong"))
		return
	}
	middleware.InfoFrom(ctx).SetCaller(session.UserID.String(), "")

	// The page is on the app's address and the forwarder says which; nothing else may open one.
	var origins []string
	if u, err := url.Parse(middleware.AppOrigin(ctx)); err == nil && u.Host != "" {
		origins = []string{u.Host}
	}
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{OriginPatterns: origins})
	if err != nil {
		return
	}
	c := &client{
		conn: conn, token: cookie.Value, userID: session.UserID.String(),
		allowed: allowed, send: make(chan []byte, sendBuffer), topics: map[string]bool{},
	}
	h.mu.Lock()
	h.clients[c] = struct{}{}
	h.mu.Unlock()
	defer func() {
		h.mu.Lock()
		delete(h.clients, c)
		h.mu.Unlock()
	}()
	h.serve(ctx, c)
}

func (h *Hub) allowedTopics(ctx context.Context, userID pgtype.UUID, app string) (map[string]bool, error) {
	allowed := map[string]bool{UserTopic(userID.String()): true}
	tenants, err := h.q.ListUserTenants(ctx, userID)
	if err != nil {
		return nil, err
	}
	for _, t := range tenants {
		allowed[TenantTopic(t.ID.String())] = true
	}
	// The stores /me lists: seller its roster, backoffice the whole tenant.
	if app == "seller" {
		stores, err := h.q.ListAssignedStores(ctx, userID)
		for _, s := range stores {
			allowed[StoreTopic(s.ID.String())] = true
		}
		return allowed, err
	}
	stores, err := h.q.ListTenantStores(ctx, userID)
	for _, s := range stores {
		allowed[StoreTopic(s.ID.String())] = true
	}
	return allowed, err
}

// What a phone sends: the topics to start or stop watching.
type request struct {
	Subscribe   []string `json:"subscribe,omitempty"`
	Unsubscribe []string `json:"unsubscribe,omitempty"`
}

// serve runs one socket: its reads (subscriptions), its writes, its ping, until any fails.
func (h *Hub) serve(ctx context.Context, c *client) {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	defer c.conn.CloseNow()

	go func() {
		defer cancel()
		for {
			var req request
			_, data, err := c.conn.Read(ctx)
			if err != nil {
				return
			}
			if json.Unmarshal(data, &req) != nil {
				c.push([]byte(`{"error":"bad_request"}`))
				continue
			}
			c.update(req)
		}
	}()

	ping := time.NewTicker(PingEvery)
	defer ping.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case msg := <-c.send:
			wctx, done := context.WithTimeout(ctx, pingTimeout)
			err := c.conn.Write(wctx, websocket.MessageText, msg)
			done()
			if err != nil {
				return
			}
		case <-ping.C:
			pctx, done := context.WithTimeout(ctx, pingTimeout)
			err := c.conn.Ping(pctx)
			done()
			if err != nil {
				return
			}
		}
	}
}

// update applies a request; a topic the user may not see is refused out loud, not ignored.
func (c *client) update(req request) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for _, t := range req.Unsubscribe {
		delete(c.topics, t)
	}
	for _, t := range req.Subscribe {
		if !c.allowed[t] || len(c.topics) >= maxTopics {
			msg, _ := json.Marshal(map[string]string{"error": "topic_not_allowed", "topic": t})
			c.push(msg)
			continue
		}
		c.topics[t] = true
	}
}
