package contract

import "time"

type SellerStoreInput struct {
	Tenant  string `path:"tenant"`
	StoreID string `path:"storeId" format:"uuid"`
}

type Product struct {
	ID         string `json:"id" format:"uuid"`
	Name       string `json:"name"`
	Price      int64  `json:"price"`
	ImageURL   string `json:"imageUrl,omitempty"`
	CategoryID string `json:"categoryId,omitempty" format:"uuid"`
}

type ProductsOutput struct {
	Body struct {
		Products []Product `json:"products" nullable:"false" doc:"Most popular first"`
	}
}

// StoreGate is what a seller may do at a store today.
type StoreGate struct {
	Gate string `json:"gate" enum:"no_day,closed,no_session,open" doc:"no_day: open it; closed: done for today; no_session: resume; open: someone is selling"`
	Date string `json:"date" format:"date"`
	// The day, once it exists.
	DayID          string     `json:"dayId,omitempty" format:"uuid"`
	ClosedAt       *time.Time `json:"closedAt,omitempty"`
	OpeningBalance int64      `json:"openingBalance"`
	Sales          int64      `json:"sales"`
	Orders         int64      `json:"orders"`
	Cups           int64      `json:"cups"`
	Expenses       int64      `json:"expenses"`
	ExpectedCash   int64      `json:"expectedCash"`
	// The session, while someone is selling; the code only for the one holding it.
	SessionID    string     `json:"sessionId,omitempty" format:"uuid"`
	SellerID     string     `json:"sellerId,omitempty" format:"uuid"`
	SellerName   string     `json:"sellerName,omitempty"`
	SellerAvatar string     `json:"sellerAvatar,omitempty"`
	StartedAt    *time.Time `json:"startedAt,omitempty"`
	ClaimCode    string     `json:"claimCode,omitempty"`
}

type StoreGateOutput struct {
	Body StoreGate
}

type OpenStoreInput struct {
	Tenant  string `path:"tenant"`
	StoreID string `path:"storeId" format:"uuid"`
	Body    struct {
		OpeningBalance int64            `json:"openingBalance" minimum:"0"`
		CashBreakdown  map[string]int64 `json:"cashBreakdown,omitempty" required:"false" doc:"How many of each note"`
	}
}

type TransferSessionInput struct {
	Tenant  string `path:"tenant"`
	StoreID string `path:"storeId" format:"uuid"`
	Body    struct {
		ClaimCode string `json:"claimCode" minLength:"1" maxLength:"6"`
	}
}

type CreateOrderInput struct {
	Tenant  string `path:"tenant"`
	StoreID string `path:"storeId" format:"uuid"`
	Body    struct {
		Items []struct {
			ProductID string `json:"productId" format:"uuid"`
			Quantity  int32  `json:"quantity" minimum:"1" maximum:"999"`
			UnitPrice int32  `json:"unitPrice" minimum:"0" doc:"As the phone showed it: a changed price is refused, never charged silently"`
		} `json:"items" minItems:"1" maxItems:"100" nullable:"false"`
	}
}

type CreateOrderOutput struct {
	Body struct {
		ID    string `json:"id" format:"uuid"`
		Total int64  `json:"total"`
	}
}
