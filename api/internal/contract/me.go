package contract

type MeOutput struct {
	Body Me
}

// Me is everything an app needs to draw for the signed-in user, saved on the phone.
type Me struct {
	User    MeUser          `json:"user"`
	Tenants []MeTenant      `json:"tenants" nullable:"false" doc:"Empty when the user belongs to no tenant"`
	Flags   map[string]bool `json:"flags" nullable:"false" doc:"The feature flags on for this user (rules on role and app); a store's own are on the store"`
}

type MeUser struct {
	ID        string `json:"id" format:"uuid"`
	Email     string `json:"email"`
	FullName  string `json:"fullName"`
	Role      string `json:"role" example:"USER"`
	AvatarURL string `json:"avatarUrl,omitempty"`
	Language  string `json:"language" example:"id" doc:"The profile's language; the app keeps a copy"`
}

type MeTenant struct {
	ID           string    `json:"id" format:"uuid"`
	Slug         string    `json:"slug"`
	Name         string    `json:"name"`
	PayFrequency string    `json:"payFrequency" example:"bi_weekly"`
	Stores       []MeStore `json:"stores" nullable:"false" doc:"Seller: the stores the user is assigned to. Backoffice: every store of the tenant"`
}

type MeStore struct {
	ID        string          `json:"id" format:"uuid"`
	Name      string          `json:"name"`
	Status    string          `json:"status" example:"active"`
	OpenTime  string          `json:"openTime" example:"08:00"`
	CloseTime string          `json:"closeTime" example:"22:00"`
	IsDefault bool            `json:"isDefault" doc:"The store this user's app opens on"`
	Flags     map[string]bool `json:"flags" nullable:"false" doc:"The feature flags on at this store (rules on tenantId and storeId); a flag not listed is off"`
}

// MePatchInput changes the caller's own profile; only the language for now.
type MePatchInput struct {
	Body struct {
		Language string `json:"language" enum:"en,id"`
	}
}
