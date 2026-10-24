package contract

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
