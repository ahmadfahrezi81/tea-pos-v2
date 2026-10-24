package handler

import (
	"context"
	"maps"
	"net/http"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/auth"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/middleware"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/telemetry"
)

// outlierMs is a load worth seeing, not averaging (a stuck one).
const outlierMs = 60_000

func registerEvents(api huma.API, d Deps) {
	route(api, huma.Operation{
		OperationID:   "sendEvents",
		Method:        http.MethodPost,
		Path:          "/events",
		Summary:       "Errors, page views and open times from an app, for PostHog",
		Tags:          []string{"system"},
		DefaultStatus: http.StatusNoContent,
	}, auth.SignedIn, func(ctx context.Context, in *contract.EventsInput) (*struct{}, error) {
		caller, _ := auth.CallerFrom(ctx)
		user := caller.UserID.String()
		origin := middleware.AppOrigin(ctx)
		appVersion := ""
		if info := middleware.InfoFrom(ctx); info != nil {
			appVersion = info.AppVersion
		}

		// What every event of the batch shares: who, which version, which phone, which visit.
		base := telemetry.UserAgent(in.UserAgent)
		base["$session_id"] = in.Body.Session
		base["app"] = caller.App
		base["app_version"] = appVersion
		base["role"] = caller.Role
		dev := in.Body.Device
		put := func(k string, v any, ok bool) {
			if ok {
				base[k] = v
			}
		}
		put("$screen_width", dev.ScreenWidth, dev.ScreenWidth > 0)
		put("$screen_height", dev.ScreenHeight, dev.ScreenHeight > 0)
		put("net", dev.Net, dev.Net != "")
		put("rtt", dev.RTT, dev.RTT > 0)
		put("downlink", dev.Downlink, dev.Downlink > 0)
		put("save_data", true, dev.SaveData)
		put("memory", dev.Memory, dev.Memory > 0)
		put("cores", dev.Cores, dev.Cores > 0)
		put("model", dev.Model, dev.Model != "")
		// The client hint is exact; the user agent's Android version is frozen at 10.
		put("$os_version", dev.OSVersion, dev.OSVersion != "")

		now := time.Now()
		for _, e := range in.Body.Events {
			at := e.At
			if at.After(now.Add(time.Hour)) || at.Before(now.Add(-24*time.Hour)) {
				at = now
			}
			props := maps.Clone(base)
			props["$current_url"] = origin + e.Path
			props["$pathname"] = e.Path
			props["$host"] = strings.TrimPrefix(strings.TrimPrefix(origin, "https://"), "http://")
			switch e.Type {
			case "error":
				d.Telemetry.Exception(user, e.Name, e.Message, telemetry.ParseStack(e.Stack, e.Chunks), props, at)
			case "app_ready":
				if e.Ready == nil {
					continue
				}
				r := e.Ready
				props["ready_ms"], props["html_ms"], props["js_ms"], props["paint_ms"] = r.ReadyMs, r.HTMLMs, r.JSMs, r.PaintMs
				props["open"], props["me"], props["screen"], props["hidden"] = r.Open, r.Me, r.Screen, r.Hidden
				props["outlier"] = r.ReadyMs > outlierMs
				d.Telemetry.Capture(user, "app_ready", props, at)
			default:
				d.Telemetry.Capture(user, "$"+e.Type, props, at)
			}
		}
		return nil, nil
	})
}
