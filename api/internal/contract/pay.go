package contract

type TenantInput struct {
	Tenant string `path:"tenant"`
}

type PayPeriodOutput struct {
	Body PayPeriod
}

// PayPeriod is the current pay period and what it owes the selling staff so far.
type PayPeriod struct {
	Frequency   string `json:"frequency" enum:"weekly,bi_weekly,four_weekly"`
	Start       string `json:"start" format:"date"`
	End         string `json:"end" format:"date"`
	PayoutDate  string `json:"payoutDate" format:"date" doc:"The day after the period ends"`
	Payouts     int    `json:"payouts" doc:"Payouts counted into the period, all staff: a schedule switch is safe at 0"`
	Commissions int64  `json:"commissions" doc:"Approved, selling staff only"`
	Claims      int64  `json:"claims"`
	Total       int64  `json:"total"`
	Approved    int    `json:"approved" doc:"Commissions and claims approved"`
	Reviewed    int    `json:"reviewed" doc:"Approved plus still pending"`
}

type PayStaffOutput struct {
	Body struct {
		Staff []PayStaff `json:"staff" nullable:"false" doc:"Every user of the tenant, admins included; by name"`
	}
}

type PayStaff struct {
	ID             string          `json:"id" format:"uuid"`
	Name           string          `json:"name"`
	Email          string          `json:"email"`
	AvatarURL      string          `json:"avatarUrl,omitempty"`
	Role           string          `json:"role" example:"USER"`
	Status         string          `json:"status" example:"active"`
	CommissionType *CommissionType `json:"commissionType,omitempty"`
	Bank           Bank            `json:"bank" doc:"Set by the staff member in the seller app"`
}

type Bank struct {
	Name          string `json:"name,omitempty"`
	AccountNumber string `json:"accountNumber,omitempty"`
	AccountHolder string `json:"accountHolder,omitempty"`
}

type CommissionType struct {
	ID         string `json:"id" format:"uuid"`
	Name       string `json:"name"`
	Slug       string `json:"slug"`
	Enabled    bool   `json:"enabled"`
	RatePerCup int64  `json:"ratePerCup" doc:"Rupiah per cup"`
}

type CommissionTypesOutput struct {
	Body struct {
		Types []CommissionType `json:"types" nullable:"false"`
	}
}

type CommissionTypeOutput struct {
	Body CommissionType
}

type CreateCommissionTypeInput struct {
	Tenant string `path:"tenant"`
	Body   struct {
		Name       string `json:"name" minLength:"1" maxLength:"100"`
		Slug       string `json:"slug" pattern:"^[A-Z0-9_]+$" maxLength:"100" doc:"Uppercase letters, digits and underscores"`
		RatePerCup int64  `json:"ratePerCup" minimum:"0" maximum:"1000000"`
	}
}

type UpdateCommissionTypeInput struct {
	Tenant string `path:"tenant"`
	ID     string `path:"id" format:"uuid"`
	Body   struct {
		Name       *string `json:"name,omitempty" minLength:"1" maxLength:"100"`
		Enabled    *bool   `json:"enabled,omitempty"`
		RatePerCup *int64  `json:"ratePerCup,omitempty" minimum:"0" maximum:"1000000"`
	}
}

type SetStaffCommissionInput struct {
	Tenant string `path:"tenant"`
	UserID string `path:"userId" format:"uuid"`
	Body   struct {
		CommissionTypeID *string `json:"commissionTypeId" format:"uuid" nullable:"true" doc:"Null takes it away"`
	}
}

type SetStaffClaimsInput struct {
	Tenant string `path:"tenant"`
	UserID string `path:"userId" format:"uuid"`
	Body   struct {
		ClaimTypeIDs []string `json:"claimTypeIds" nullable:"false" maxItems:"100" doc:"Exactly these enabled claim types"`
	}
}

type ClaimType struct {
	ID                 string   `json:"id" format:"uuid"`
	Name               string   `json:"name"`
	Slug               string   `json:"slug"`
	Frequency          string   `json:"frequency" enum:"daily,weekly,monthly,one_time"`
	Enabled            bool     `json:"enabled"`
	Amount             int64    `json:"amount"`
	Source             string   `json:"source" enum:"manual,auto,auto_submit" doc:"manual: staff submits; auto_submit: made for staff, an admin reviews; auto: made and approved when enough hours were worked"`
	AutoThresholdHours *float64 `json:"autoThresholdHours,omitempty"`
}

type ClaimTypesOutput struct {
	Body struct {
		Types []ClaimType `json:"types" nullable:"false"`
	}
}

type ClaimTypeOutput struct {
	Body ClaimType
}

type CreateClaimTypeInput struct {
	Tenant string `path:"tenant"`
	Body   struct {
		Name               string   `json:"name" minLength:"1" maxLength:"100"`
		Slug               string   `json:"slug" pattern:"^[A-Z0-9_]+$" maxLength:"100"`
		Frequency          string   `json:"frequency" enum:"daily,weekly,monthly,one_time"`
		Amount             int64    `json:"amount" minimum:"0" maximum:"100000000"`
		Source             string   `json:"source" enum:"manual,auto,auto_submit"`
		AutoThresholdHours *float64 `json:"autoThresholdHours,omitempty" minimum:"0" maximum:"24" doc:"Needed for auto"`
	}
}

type UpdateClaimTypeInput struct {
	Tenant string `path:"tenant"`
	ID     string `path:"id" format:"uuid"`
	Body   struct {
		Name    *string `json:"name,omitempty" minLength:"1" maxLength:"100"`
		Enabled *bool   `json:"enabled,omitempty"`
	}
}

type ClaimTypeIDInput struct {
	Tenant string `path:"tenant"`
	ID     string `path:"id" format:"uuid"`
}

type ClaimEligibleOutput struct {
	Body struct {
		UserIDs []string `json:"userIds" nullable:"false"`
	}
}

type SetClaimEligibleInput struct {
	Tenant string `path:"tenant"`
	ID     string `path:"id" format:"uuid"`
	Body   struct {
		UserIDs []string `json:"userIds" nullable:"false" maxItems:"500" doc:"Everyone who may claim it; the rest may not"`
	}
}

type SetPayScheduleInput struct {
	Tenant string `path:"tenant"`
	Body   struct {
		Frequency string `json:"frequency" enum:"weekly,bi_weekly,four_weekly"`
	}
}

type PayPeriodAtInput struct {
	Tenant string `path:"tenant"`
	Start  string `path:"start" doc:"Any day of the period (its first, as the app links it), or current"`
}

type PayPeriodAtOutput struct {
	Body PayPeriodAt
}

// PayPeriodAt is the Pay tab's home: one period and each person it pays, by what needs the admin.
type PayPeriodAt struct {
	Frequency  string `json:"frequency" enum:"weekly,bi_weekly,four_weekly"`
	Start      string `json:"start" format:"date"`
	End        string `json:"end" format:"date"`
	PayoutDate string `json:"payoutDate" format:"date" doc:"The day after the period ends"`
	Previous   string `json:"previous" format:"date" doc:"The period before's first day"`
	Next       string `json:"next,omitempty" format:"date" doc:"The next period's first day; none after the current one"`
	Owed       int64  `json:"owed" doc:"Approved, every person not yet paid or skipped"`
	ToReview   int    `json:"toReview" doc:"People with commissions or claims still to review"`
	// Every payout overlapping the period (a schedule change can leave them uneven), by name.
	People []Payout `json:"people" nullable:"false"`
}
