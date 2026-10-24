package domain

import (
	"fmt"
	"time"
)

// PayFrequencies are the tenant's possible pay cadences: whole weeks, Monday to Sunday, so one
// can hand over to another on any Monday without a period overlapping or falling short.
var PayFrequencies = map[string]int{"weekly": 1, "bi_weekly": 2, "four_weekly": 4}

// payEpoch is Monday 6 January 2025: multi-week periods are fixed blocks counted from it, as the
// old app counts them, so both apps agree on every period while they run side by side.
var payEpoch = time.Date(2025, 1, 6, 0, 0, 0, 0, time.UTC)

// PayWindow is the period date falls in, its first and last days, for the tenant's frequency.
func PayWindow(date time.Time, frequency string) (start, end time.Time, err error) {
	weeks, ok := PayFrequencies[frequency]
	if !ok {
		return start, end, fmt.Errorf("unknown pay frequency %q", frequency)
	}
	d := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, time.UTC)
	if weeks == 1 {
		// Back to Monday.
		start = d.AddDate(0, 0, -((int(d.Weekday()) + 6) % 7))
		return start, start.AddDate(0, 0, 6), nil
	}
	days := weeks * 7
	since := int(d.Sub(payEpoch).Hours() / 24)
	block := since / days
	if since < 0 && since%days != 0 {
		block-- // floor, for dates before the epoch
	}
	start = payEpoch.AddDate(0, 0, block*days)
	return start, start.AddDate(0, 0, days-1), nil
}

// PayoutDate is when a period's pay is expected: the day after it ends.
func PayoutDate(end time.Time) time.Time {
	return end.AddDate(0, 0, 1)
}

// NonSellerSlug is the commission type of staff who earn nothing per cup (family, support):
// left out of the selling staff's totals, and their commissions approve themselves.
const NonSellerSlug = "SELLER_0"
