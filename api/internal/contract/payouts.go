package contract

// Payout is one person's pay for one period: the sums of its approved rows.
type Payout struct {
	ID          string `json:"id" format:"uuid"`
	UserID      string `json:"userId" format:"uuid"`
	Name        string `json:"name"`
	AvatarURL   string `json:"avatarUrl,omitempty"`
	NonSeller   bool   `json:"nonSeller" doc:"No commission per cup (SELLER_0 or rate 0): hidden from the list by default"`
	Status      string `json:"status" enum:"pending,paid,skipped"`
	Start       string `json:"start" format:"date"`
	End         string `json:"end" format:"date"`
	PaidAt      string `json:"paidAt,omitempty" format:"date-time"`
	Commissions int64  `json:"commissions"`
	Claims      int64  `json:"claims"`
	Total       int64  `json:"total"`
	Cups        int64  `json:"cups"`
	Orders      int64  `json:"orders"`
	Approved    int    `json:"approved" doc:"Commissions and claims approved"`
	Pending     int    `json:"pending" doc:"Still to review"`
}

type PayoutInput struct {
	Tenant string `path:"tenant"`
	ID     string `path:"id" format:"uuid"`
}

type PayslipOutput struct {
	Body Payslip
}

type Payslip struct {
	Payout
	PaymentProofURL string              `json:"paymentProofUrl,omitempty" doc:"A signed address, for a few minutes"`
	Notes           string              `json:"notes,omitempty" doc:"For the staff member"`
	PaidBy          string              `json:"paidBy,omitempty"`
	RatePerCup      int64               `json:"ratePerCup" doc:"Of the period's first commission; 0 without any"`
	Commissions     []PayslipCommission `json:"commissionRows" nullable:"false"`
	Claims          []PayslipClaim      `json:"claimRows" nullable:"false"`
}

type PayslipCommission struct {
	ID         string `json:"id" format:"uuid"`
	Date       string `json:"date" format:"date"`
	Status     string `json:"status" enum:"pending,approved,rejected"`
	StoreName  string `json:"storeName,omitempty"`
	Cups       int64  `json:"cups"`
	Orders     int64  `json:"orders"`
	RatePerCup int64  `json:"ratePerCup"`
	Amount     int64  `json:"amount"`
}

type PayslipClaim struct {
	ID             string   `json:"id" format:"uuid"`
	Date           string   `json:"date" format:"date"`
	Status         string   `json:"status" enum:"pending,approved,rejected"`
	Type           string   `json:"type,omitempty"`
	Amount         int64    `json:"amount"`
	Notes          string   `json:"notes,omitempty"`
	HoursWorked    *float64 `json:"hoursWorked,omitempty"`
	ThresholdHours *float64 `json:"thresholdHours,omitempty"`
}

type DecisionInput struct {
	Tenant string `path:"tenant"`
	ID     string `path:"id" format:"uuid"`
	Body   struct {
		Status string `json:"status" enum:"pending,approved,rejected"`
	}
}

type ReviewDayInput struct {
	Tenant string `path:"tenant"`
	ID     string `path:"id" format:"uuid" doc:"The payout"`
	Date   string `path:"date" format:"date"`
	Body   struct {
		Status string `json:"status" enum:"approved,rejected"`
	}
}

type ReviewDayOutput struct {
	Body struct {
		Commissions int64 `json:"commissions" doc:"How many were decided"`
		Claims      int64 `json:"claims"`
	}
}

type SettlePayoutInput struct {
	Tenant string `path:"tenant"`
	ID     string `path:"id" format:"uuid"`
	Body   struct {
		Status          string `json:"status" enum:"paid,skipped" doc:"skipped: nothing owed, no transfer"`
		PaymentProofURL string `json:"paymentProofUrl,omitempty" maxLength:"1000" doc:"The transfer screenshot's address from POST /files (purpose payroll_proof); needed to pay"`
		Notes           string `json:"notes,omitempty" maxLength:"500" doc:"For the staff member, on their payslip; cannot be changed after"`
	}
}
