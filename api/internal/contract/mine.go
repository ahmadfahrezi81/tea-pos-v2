package contract

// MyPayOutput is the caller's own pay: how they are paid and every period so far.
type MyPayOutput struct {
	Body struct {
		PayFrequency string   `json:"payFrequency" example:"bi_weekly"`
		NextPayout   string   `json:"nextPayout" format:"date"`
		RatePerCup   *int64   `json:"ratePerCup" doc:"Null without a commission type"`
		Slug         string   `json:"slug,omitempty" doc:"The commission type"`
		Payouts      []Payout `json:"payouts" nullable:"false" doc:"Newest first"`
	}
}

type MyWorkDaysInput struct {
	Tenant string `path:"tenant"`
	From   string `query:"from" required:"true" format:"date"`
	To     string `query:"to" required:"true" format:"date"`
}

type MyWorkDaysOutput struct {
	Body struct {
		Days []string `json:"days" nullable:"false" doc:"The days the caller held a store"`
	}
}

type MyClaimsInput struct {
	Tenant string `path:"tenant"`
	From   string `query:"from" required:"true" format:"date"`
	To     string `query:"to" required:"true" format:"date"`
}

type MyClaimsOutput struct {
	Body struct {
		Claims []MyClaim `json:"claims" nullable:"false" doc:"Newest first"`
	}
}

type MyClaim struct {
	ID     string `json:"id" format:"uuid"`
	Date   string `json:"date" format:"date"`
	Type   string `json:"type,omitempty"`
	Amount int64  `json:"amount"`
	Status string `json:"status" enum:"pending,approved,rejected"`
}

type MyClaimTypesOutput struct {
	Body struct {
		Types     []MyClaimType `json:"types" nullable:"false"`
		WorkDates []string      `json:"workDates" nullable:"false" doc:"The days worked this period, for a weekly claim"`
	}
}

type MyClaimType struct {
	ID        string `json:"id" format:"uuid"`
	Name      string `json:"name"`
	Frequency string `json:"frequency" enum:"daily,weekly,monthly,one_time"`
	Amount    int64  `json:"amount"`
	Source    string `json:"source" enum:"manual,auto,auto_submit"`
	Claimable bool   `json:"claimable" doc:"Room left this period, month or day"`
}

type CreateMyClaimInput struct {
	Tenant string `path:"tenant"`
	Body   struct {
		TypeID   string `json:"typeId" format:"uuid"`
		Date     string `json:"date" format:"date"`
		StoreID  string `json:"storeId,omitempty" required:"false" format:"uuid"`
		Notes    string `json:"notes,omitempty" required:"false" maxLength:"500"`
		PhotoURL string `json:"photoUrl,omitempty" required:"false" maxLength:"1000" doc:"The address from POST /files (purpose reimbursement)"`
	}
}
