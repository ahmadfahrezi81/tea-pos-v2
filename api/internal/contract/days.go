package contract

import "encoding/json"

type DaysInput struct {
	Tenant string `path:"tenant"`
	From   string `query:"from" required:"true" format:"date"`
	To     string `query:"to" required:"true" format:"date" doc:"Included; at most 400 days after from"`
	Stores
}

type DaysOutput struct {
	Body struct {
		Days []Day `json:"days" nullable:"false" doc:"Newest first; with several stores, each store's day"`
	}
}

// Day is one store's day: its cash, what it sold, its expenses and who worked.
type Day struct {
	ID             string       `json:"id" format:"uuid"`
	StoreID        string       `json:"storeId" format:"uuid"`
	StoreName      string       `json:"storeName"`
	Date           string       `json:"date" format:"date"`
	OpeningBalance int64        `json:"openingBalance"`
	Sales          int64        `json:"sales"`
	Orders         int64        `json:"orders"`
	Cups           int64        `json:"cups"`
	Expenses       int64        `json:"expenses"`
	ExpectedCash   int64        `json:"expectedCash"`
	ActualCash     *int64       `json:"actualCash" doc:"Null until counted at closing"`
	Variance       *int64       `json:"variance"`
	Notes          string       `json:"notes,omitempty"`
	ClosedAt       string       `json:"closedAt,omitempty" format:"date-time" doc:"Empty while the day is open"`
	ExpenseItems   []DayExpense `json:"expenseItems" nullable:"false"`
	Sellers        []DaySeller  `json:"sellers" nullable:"false" doc:"Who worked (a session or an order), the most cups first"`
}

type DayExpense struct {
	ID     string `json:"id" format:"uuid"`
	Type   string `json:"type"`
	Amount int64  `json:"amount"`
	Notes  string `json:"notes,omitempty"`
}

type DaySeller struct {
	UserID    string `json:"userId" format:"uuid"`
	Name      string `json:"name"`
	AvatarURL string `json:"avatarUrl,omitempty"`
	Cups      int64  `json:"cups"`
}

type DayInput struct {
	Tenant string `path:"tenant"`
	ID     string `path:"id" format:"uuid"`
}

type DayOutput struct {
	Body DayDetail
}

type DayDetail struct {
	Day
	OpenedBy string       `json:"openedBy,omitempty"`
	ClosedBy string       `json:"closedBy,omitempty"`
	OpenedAt string       `json:"openedAt,omitempty" format:"date-time"`
	Photos   []DayPhoto   `json:"photos" nullable:"false"`
	Products []DayProduct `json:"products" nullable:"false" doc:"What the day sold per product, most first"`
}

type DayPhoto struct {
	Type     string       `json:"type" example:"closing:tea" doc:"opening, closing:ice, closing:syrup, closing:bags, closing:cups, closing:tea"`
	URL      string       `json:"url" doc:"A signed address, for a few minutes; empty when it could not be signed"`
	Quantity *DayQuantity `json:"quantity,omitempty"`
}

type DayQuantity struct {
	Value float64 `json:"value"`
	Unit  string  `json:"unit"`
}

type DayProduct struct {
	Name     string `json:"name"`
	Quantity int64  `json:"quantity"`
	Revenue  int64  `json:"revenue"`
}

type DayActivityOutput struct {
	Body struct {
		Events []DayEvent `json:"events" nullable:"false" doc:"Oldest first"`
	}
}

type DayEvent struct {
	ID       string          `json:"id" format:"uuid"`
	Type     string          `json:"type" example:"store_opened"`
	At       string          `json:"at" format:"date-time"`
	UserName string          `json:"userName,omitempty"`
	Metadata json.RawMessage `json:"metadata" doc:"As the event saved it; a photo_url in it is a signed address"`
}

type DaySessionsOutput struct {
	Body struct {
		Sessions []DaySession `json:"sessions" nullable:"false" doc:"In the order they started"`
	}
}

type DaySession struct {
	ID                string `json:"id" format:"uuid"`
	UserID            string `json:"userId" format:"uuid"`
	UserName          string `json:"userName,omitempty"`
	AvatarURL         string `json:"avatarUrl,omitempty"`
	StartedAt         string `json:"startedAt" format:"date-time"`
	EndedAt           string `json:"endedAt,omitempty" format:"date-time"`
	Status            string `json:"status" example:"active"`
	PreviousSessionID string `json:"previousSessionId,omitempty" doc:"The session this one took over from"`
}

// RangeInput is a Store screen's days: from and to, both included, in the stores' time zone.
type RangeInput struct {
	Tenant string `path:"tenant"`
	From   string `query:"from" required:"true" format:"date"`
	To     string `query:"to" required:"true" format:"date" doc:"Included; at most 400 days after from"`
	Stores
}

type SalesProductsOutput struct {
	Body struct {
		Products []SalesProduct `json:"products" nullable:"false" doc:"Most first"`
	}
}

type SalesProduct struct {
	ID       string `json:"id" format:"uuid"`
	Name     string `json:"name"`
	Quantity int64  `json:"quantity"`
}

type TeaWasteOutput struct {
	Body struct {
		Days []TeaWasteDay `json:"days" nullable:"false" doc:"Only days whose tea was measured at closing"`
	}
}

type TeaWasteDay struct {
	Date   string  `json:"date" format:"date"`
	Litres float64 `json:"litres"`
}
