package domain

import "time"

// SellerHistoryMonths is how far back the seller app reads: this month and the two before.
const SellerHistoryMonths = 3

// SellerEarliest is the first day a seller may read on now's date: the 1st of the month two months back, in WIB.
func SellerEarliest(now time.Time) time.Time {
	n := now.In(WIB)
	return time.Date(n.Year(), n.Month()-(SellerHistoryMonths-1), 1, 0, 0, 0, 0, WIB)
}
