package contract

import "time"

// Stores is which stores a Store screen adds up: the ones named, or every store of the tenant.
type Stores struct {
	StoreIDs []string `query:"storeId" format:"uuid" maxItems:"100" doc:"Repeat for several; none is every store of the tenant (All stores)"`
}

type SalesDaysInput = RangeInput

type SalesDaysOutput struct {
	Body struct {
		Days []SalesDay `json:"days" nullable:"false" doc:"Only days with a summary, oldest first"`
	}
}

type SalesDay struct {
	Date      string `json:"date" format:"date"`
	Sales     int64  `json:"sales" doc:"Rupiah"`
	Orders    int64  `json:"orders"`
	Cups      int64  `json:"cups"`
	Stores    int    `json:"stores" doc:"How many of the stores have this day"`
	NotClosed int    `json:"notClosed" doc:"How many of them are not closed yet: their totals come when they close"`
}

type StoresLiveInput struct {
	Tenant string `path:"tenant"`
}

type StoresLiveOutput struct {
	Body struct {
		Date   string      `json:"date" format:"date" doc:"Today, in the stores' time zone"`
		Stores []StoreLive `json:"stores" nullable:"false" doc:"Open stores first, then by name"`
	}
}

type StoreLive struct {
	ID     string `json:"id" format:"uuid"`
	Name   string `json:"name"`
	Status string `json:"status" example:"active" doc:"The store itself: active, fake (a demo) or inactive"`
	Open   bool   `json:"open" doc:"Someone is selling there now"`
	// When open: since when and who; when closed: when it last closed.
	OpenSince    *time.Time `json:"openSince,omitempty"`
	SellerName   string     `json:"sellerName,omitempty"`
	SellerAvatar string     `json:"sellerAvatar,omitempty" doc:"The seller's Google photo address"`
	LastClosed   *time.Time `json:"lastClosed,omitempty"`
	Orders       int64      `json:"orders"`
	Cups         int64      `json:"cups"`
	Sales        int64      `json:"sales"`
	Sellers      []DaySeller `json:"sellers" nullable:"false" doc:"Who sold here today and their cups, the most first; the seller on shift is in it even before their first order"`
}
