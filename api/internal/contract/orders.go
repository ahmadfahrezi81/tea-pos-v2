package contract

import "github.com/ahmadfahrezi81/tea-pos-v2/api/internal/page"

type DayOrdersInput struct {
	Tenant string `path:"tenant"`
	Date   string `query:"date" required:"true" format:"date" doc:"The day, in the stores' time zone"`
	Stores
	page.Input
}

type DayOrdersOutput struct {
	Body page.Output[Order]
}

type Order struct {
	ID            string      `json:"id" format:"uuid"`
	At            string      `json:"at" format:"date-time"`
	Total         int64       `json:"total"`
	PaymentMethod string      `json:"paymentMethod" example:"cash"`
	StoreName     string      `json:"storeName"`
	Seller        string      `json:"seller,omitempty"`
	Cups          int64       `json:"cups"`
	Items         []OrderItem `json:"items" nullable:"false"`
}

type OrderItem struct {
	ID         string `json:"id" format:"uuid"`
	Name       string `json:"name"`
	Quantity   int64  `json:"quantity"`
	UnitPrice  int64  `json:"unitPrice"`
	TotalPrice int64  `json:"totalPrice"`
}

type SalesHoursInput struct {
	Tenant string `path:"tenant"`
	Date   string `query:"date" required:"true" format:"date"`
	Stores
}

type SalesHoursOutput struct {
	Body struct {
		Orders int64       `json:"orders"`
		Cups   int64       `json:"cups"`
		Sales  int64       `json:"sales"`
		Hours  []SalesHour `json:"hours" nullable:"false" doc:"From the hour before the first sale to the hour after the last; empty without sales"`
	}
}

type SalesHour struct {
	Hour   int   `json:"hour" minimum:"0" maximum:"23"`
	Orders int64 `json:"orders"`
	Cups   int64 `json:"cups"`
}
