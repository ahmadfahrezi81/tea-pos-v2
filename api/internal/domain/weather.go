// Package domain holds pure business rules: no database, no HTTP. Its tests are the only
// ones beside the code (the RFC's rule).
package domain

import (
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
	"time"
)

// WIB is the stores' time zone. Indonesia has no daylight saving, so a fixed offset is exact
// and needs no time zone data in the image.
var WIB = time.FixedZone("WIB", 7*60*60)

// CellSize is a weather cell's side in degrees: about 5.5 km in Bogor. Stores in one cell
// share one fetch.
const CellSize = 0.05

// Cell is the weather cell a coordinate falls in: its centre, "lat,lng".
func Cell(lat, lng float64) string {
	round := func(v float64) float64 { return math.Round(v/CellSize) * CellSize }
	return fmt.Sprintf("%.2f,%.2f", round(lat), round(lng))
}

// CellCentre is where a cell's weather is fetched for.
func CellCentre(cell string) (lat, lng float64, err error) {
	a, b, ok := strings.Cut(cell, ",")
	if ok {
		if lat, err = strconv.ParseFloat(a, 64); err == nil {
			lng, err = strconv.ParseFloat(b, 64)
		}
	}
	if !ok || err != nil {
		return 0, 0, fmt.Errorf("weather cell %q: want \"lat,lng\"", cell)
	}
	return lat, lng, nil
}

// StoreHours is a store's place and opening hours ("08:00", "22:00", WIB).
type StoreHours struct {
	Lat, Lng    float64
	Open, Close string
}

// ForecastLead is how long before a store opens its cell's forecast is fetched.
const ForecastLead = time.Hour

// CellsDue is the cells whose weather is worth fetching at now: a store in the cell opens
// within ForecastLead or is open. Nothing at night. Sorted, so a run is predictable.
func CellsDue(now time.Time, stores []StoreHours) []string {
	now = now.In(WIB)
	due := map[string]bool{}
	for _, s := range stores {
		open, okOpen := clock(now, s.Open)
		closing, okClose := clock(now, s.Close)
		if !okOpen || !okClose {
			continue
		}
		// A store open past midnight closes the next day.
		if !closing.After(open) {
			closing = closing.Add(24 * time.Hour)
		}
		if !now.Before(open.Add(-ForecastLead)) && now.Before(closing) {
			due[Cell(s.Lat, s.Lng)] = true
		}
	}
	cells := make([]string, 0, len(due))
	for c := range due {
		cells = append(cells, c)
	}
	sort.Strings(cells)
	return cells
}

// Cells is every store's cell, open or not, sorted.
func Cells(stores []StoreHours) []string {
	seen := map[string]bool{}
	for _, s := range stores {
		seen[Cell(s.Lat, s.Lng)] = true
	}
	cells := make([]string, 0, len(seen))
	for c := range seen {
		cells = append(cells, c)
	}
	sort.Strings(cells)
	return cells
}

// clock is "HH:MM" on now's date, in WIB.
func clock(now time.Time, hhmm string) (time.Time, bool) {
	t, err := time.ParseInLocation("15:04", hhmm, WIB)
	if err != nil {
		return time.Time{}, false
	}
	y, m, d := now.Date()
	return time.Date(y, m, d, t.Hour(), t.Minute(), 0, 0, WIB), true
}
