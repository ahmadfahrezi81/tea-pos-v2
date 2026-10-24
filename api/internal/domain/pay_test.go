package domain

import (
	"testing"
	"time"
)

func day(s string) time.Time {
	t, err := time.Parse(time.DateOnly, s)
	if err != nil {
		panic(err)
	}
	return t
}

// The old app's windows, as its own getPayWindowBounds (packages/utils/week.ts) computes them.
func TestPayWindow(t *testing.T) {
	for _, c := range []struct{ date, frequency, start, end string }{
		{"2026-10-25", "weekly", "2026-10-19", "2026-10-25"}, // a Sunday ends its week
		{"2026-10-26", "weekly", "2026-10-26", "2026-11-01"}, // a Monday starts one
		{"2025-01-06", "bi_weekly", "2025-01-06", "2025-01-19"},
		{"2025-01-19", "bi_weekly", "2025-01-06", "2025-01-19"},
		{"2025-01-20", "bi_weekly", "2025-01-20", "2025-02-02"},
		{"2026-10-25", "bi_weekly", "2026-10-12", "2026-10-25"},
		{"2025-12-31", "bi_weekly", "2025-12-22", "2026-01-04"}, // across a year end
		{"2025-01-05", "bi_weekly", "2024-12-23", "2025-01-05"}, // before the epoch
		{"2026-10-25", "four_weekly", "2026-10-12", "2026-11-08"},
		{"2025-02-02", "four_weekly", "2025-01-06", "2025-02-02"},
		{"2025-02-03", "four_weekly", "2025-02-03", "2025-03-02"},
	} {
		start, end, err := PayWindow(day(c.date), c.frequency)
		if err != nil || start.Format(time.DateOnly) != c.start || end.Format(time.DateOnly) != c.end {
			t.Errorf("%s %s: %s to %s (%v), want %s to %s", c.date, c.frequency, start.Format(time.DateOnly), end.Format(time.DateOnly), err, c.start, c.end)
		}
	}
	if _, _, err := PayWindow(day("2026-10-25"), "monthly"); err == nil {
		t.Error("an unknown frequency must fail, never guess")
	}
	if got := PayoutDate(day("2026-10-25")).Format(time.DateOnly); got != "2026-10-26" {
		t.Errorf("payout date: %s", got)
	}
}
