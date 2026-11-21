package chatevent

// Link is what a message points at (Step 75), stored in its metadata as {kind, id}, never as an
// address: each app opens it its own way. A new kind is a line here, in the handler's resolve,
// and in packages/chat/links.ts.
type Link struct {
	Kind string `json:"kind"`
	ID   string `json:"id"`
}

const (
	LinkDay       = "day"        // store_daily_summaries.id
	LinkPayPeriod = "pay_period" // the period's first day, 2026-11-17
	LinkPayout    = "payout"     // payroll_payouts.id
	LinkWhatsNew  = "whats_new"  // a version in What's new
)
