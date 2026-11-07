package contract

// StoreSettings is everything Store settings shows and changes about one store.
type StoreSettings struct {
	ID        string   `json:"id" format:"uuid"`
	Name      string   `json:"name"`
	Address   string   `json:"address,omitempty"`
	Latitude  *float64 `json:"latitude,omitempty"`
	Longitude *float64 `json:"longitude,omitempty"`
	Status    string   `json:"status" enum:"active,fake,inactive" doc:"fake: a demo store"`
	OpenTime  string   `json:"openTime" example:"08:00"`
	CloseTime string   `json:"closeTime" example:"22:00"`
}

// StoreChange is a store's fields, set at once: a new store or an edit.
type StoreChange struct {
	Name      string   `json:"name" maxLength:"100"`
	Address   string   `json:"address" maxLength:"300" doc:"Empty clears it"`
	Latitude  *float64 `json:"latitude,omitempty" minimum:"-90" maximum:"90" doc:"Leave out for none"`
	Longitude *float64 `json:"longitude,omitempty" minimum:"-180" maximum:"180" doc:"Leave out for none"`
	Status    string   `json:"status" enum:"active,fake,inactive"`
	OpenTime  string   `json:"openTime" pattern:"^([01][0-9]|2[0-3]):[0-5][0-9]$" example:"08:00"`
	CloseTime string   `json:"closeTime" pattern:"^([01][0-9]|2[0-3]):[0-5][0-9]$" example:"22:00"`
}

type StoreSettingsListOutput struct {
	Body struct {
		Stores []StoreSettings `json:"stores" nullable:"false" doc:"Active, then demo, then inactive, by name"`
	}
}

type StoreSettingsOutput struct {
	Body StoreSettings
}

type StoreSettingsInput struct {
	Tenant  string `path:"tenant"`
	StoreID string `path:"storeId" format:"uuid"`
}

type CreateStoreInput struct {
	Tenant string `path:"tenant"`
	Body   StoreChange
}

type UpdateStoreInput struct {
	Tenant  string `path:"tenant"`
	StoreID string `path:"storeId" format:"uuid"`
	Body    StoreChange
}
