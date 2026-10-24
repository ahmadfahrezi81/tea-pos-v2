// Package weather fetches each store area's weather from Tomorrow.io and keeps it per cell
// (domain.Cell). Run by the worker's schedule, and once a day for staging.
package weather

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/domain"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
)

// MaxCellsPerRun keeps a run every 20 minutes within Tomorrow.io's free plan (25 calls an
// hour): 8 cells is 24 calls. More cells than that would need a longer interval.
const MaxCellsPerRun = 8

// The old app's fixed point, whose cell still writes its weather_hourly table.
const (
	v1Lat, v1Lng       = -6.60534088404916, 106.76243694791512
	v1City, v1Region   = "Ciomas", "Bogor"
	v1Open, v1Close    = "06:00", "22:00" // from 05:00 with the hour before opening, as the cron website
	tomorrowEndpoint   = "https://api.tomorrow.io/v4/timelines"
	tomorrowTimeout    = 15 * time.Second
	defaultWeatherCode = 1000
)

type Fetcher struct {
	Key      string
	Queries  *store.Queries
	Endpoint string // Tomorrow.io's; tests point it elsewhere
	Client   *http.Client
}

// Hour is one hour of weather, in WIB.
type Hour struct {
	Time                    time.Time
	Temperature, RainChance float64
	Code                    int32
	Observed                bool
}

// Run fetches the cells due now (all cells when all is set: staging's daily run), one call
// each, and stores what comes back. A cell that fails does not stop the others.
func (f *Fetcher) Run(ctx context.Context, now time.Time, all bool) error {
	if f.Key == "" {
		return errors.New("weather: TOMORROW_IO_API_KEY is not set")
	}
	rows, err := f.Queries.ListStoreHours(ctx)
	if err != nil {
		return fmt.Errorf("stores: %w", err)
	}
	stores := make([]domain.StoreHours, len(rows))
	for i, r := range rows {
		stores[i] = domain.StoreHours{Lat: r.Lat, Lng: r.Lng, Open: r.OpenTime, Close: r.CloseTime}
	}
	// The old app reads its fixed point whatever the stores have (most have no place yet).
	stores = append(stores, domain.StoreHours{Lat: v1Lat, Lng: v1Lng, Open: v1Open, Close: v1Close})
	cells := domain.CellsDue(now, stores)
	if all {
		cells = domain.Cells(stores)
	}
	if len(cells) > MaxCellsPerRun {
		slog.WarnContext(ctx, "weather: more cells than one run may fetch; the rest wait", "cells", len(cells), "max", MaxCellsPerRun)
		cells = cells[:MaxCellsPerRun]
	}

	var errs []error
	for _, cell := range cells {
		if err := f.fetchCell(ctx, cell); err != nil {
			errs = append(errs, fmt.Errorf("cell %s: %w", cell, err))
		}
	}
	slog.InfoContext(ctx, "weather fetched", "cells", len(cells), "failed", len(errs))
	return errors.Join(errs...)
}

func (f *Fetcher) fetchCell(ctx context.Context, cell string) error {
	lat, lng, err := domain.CellCentre(cell)
	if err != nil {
		return err
	}
	hours, err := f.fetch(ctx, lat, lng)
	if err != nil {
		return err
	}
	v1 := cell == domain.Cell(v1Lat, v1Lng)
	for _, h := range hours {
		t := h.Time.In(domain.WIB)
		date := pgtype.Date{Time: time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC), Valid: true}
		temp, rain := math.Round(h.Temperature), math.Round(h.RainChance)
		if err := f.Queries.UpsertWeatherHour(ctx, store.UpsertWeatherHourParams{
			Cell: cell, Date: date, Hour: int16(t.Hour()),
			Temperature: temp, PrecipitationProbability: rain, WeatherCode: h.Code, Observed: h.Observed,
		}); err != nil {
			return err
		}
		if v1 {
			if err := f.Queries.UpsertWeatherHourlyV1(ctx, store.UpsertWeatherHourlyV1Params{
				Date: date, Hour: int16(t.Hour()), Temperature: temp, PrecipitationProbability: rain,
				WeatherCode: h.Code, Lat: v1Lat, Lng: v1Lng, City: v1City, Region: v1Region,
			}); err != nil {
				return err
			}
		}
	}
	return nil
}

// fetch asks Tomorrow.io for only what is kept: three fields, now and the next 24 hours,
// in one call (the old app made two, each returning days of every field).
func (f *Fetcher) fetch(ctx context.Context, lat, lng float64) ([]Hour, error) {
	body, _ := json.Marshal(map[string]any{
		"location":  fmt.Sprintf("%f,%f", lat, lng),
		"fields":    []string{"temperature", "precipitationProbability", "weatherCode"},
		"timesteps": []string{"current", "1h"},
		"startTime": "now",
		"endTime":   "nowPlus24h",
		"units":     "metric",
	})
	endpoint := f.Endpoint
	if endpoint == "" {
		endpoint = tomorrowEndpoint
	}
	ctx, cancel := context.WithTimeout(ctx, tomorrowTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint+"?apikey="+f.Key, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	client := f.Client
	if client == nil {
		client = http.DefaultClient
	}
	resp, err := client.Do(req)
	if err != nil {
		// The key is in the URL; never log the request.
		return nil, errors.New("tomorrow.io: request failed")
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("tomorrow.io: status %d", resp.StatusCode)
	}

	var out struct {
		Data struct {
			Timelines []struct {
				Timestep  string `json:"timestep"`
				Intervals []struct {
					StartTime time.Time `json:"startTime"`
					Values    struct {
						Temperature              *float64 `json:"temperature"`
						PrecipitationProbability *float64 `json:"precipitationProbability"`
						WeatherCode              *int32   `json:"weatherCode"`
					} `json:"values"`
				} `json:"intervals"`
			} `json:"timelines"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("tomorrow.io: %w", err)
	}
	var hours []Hour
	for _, tl := range out.Data.Timelines {
		for _, iv := range tl.Intervals {
			h := Hour{Time: iv.StartTime, Observed: tl.Timestep == "current", Code: defaultWeatherCode}
			if v := iv.Values.Temperature; v != nil {
				h.Temperature = *v
			}
			if v := iv.Values.PrecipitationProbability; v != nil {
				h.RainChance = *v
			}
			if v := iv.Values.WeatherCode; v != nil {
				h.Code = *v
			}
			hours = append(hours, h)
		}
	}
	if len(hours) == 0 {
		return nil, errors.New("tomorrow.io: no weather in the answer")
	}
	return hours, nil
}
