package domain

import (
	"testing"
	"time"
)

func TestSellerEarliest(t *testing.T) {
	cases := map[string]string{
		"2026-11-08 12:00": "2026-09-01",
		"2026-12-01 00:30": "2026-10-01",
		"2027-01-31 23:59": "2026-11-01",
		"2027-02-15 08:00": "2026-12-01",
	}
	for now, want := range cases {
		n, _ := time.ParseInLocation("2006-01-02 15:04", now, WIB)
		if got := SellerEarliest(n).Format(time.DateOnly); got != want {
			t.Errorf("SellerEarliest(%s) = %s, want %s", now, got, want)
		}
	}
	// Late on the 30th UTC is already the 1st in WIB.
	utc := time.Date(2026, 11, 30, 18, 0, 0, 0, time.UTC)
	if got := SellerEarliest(utc).Format(time.DateOnly); got != "2026-10-01" {
		t.Errorf("WIB month: got %s", got)
	}
}
