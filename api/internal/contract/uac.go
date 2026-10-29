package contract

import "time"

type UacOutput struct {
	Body struct {
		Requests []AccessRequest `json:"requests" nullable:"false" doc:"Waiting, oldest first"`
		People   []UacPerson     `json:"people" nullable:"false" doc:"Active first, then by name"`
	}
}

type AccessRequest struct {
	ID        string    `json:"id" format:"uuid"`
	UserID    string    `json:"userId" format:"uuid"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	AvatarURL string    `json:"avatarUrl,omitempty"`
	At        time.Time `json:"at"`
}

type UacPerson struct {
	ID        string   `json:"id" format:"uuid"`
	Name      string   `json:"name"`
	Email     string   `json:"email"`
	AvatarURL string   `json:"avatarUrl,omitempty"`
	Phone     string   `json:"phone,omitempty"`
	Since     string   `json:"since,omitempty" format:"date-time" doc:"When the account was made"`
	Active    bool     `json:"active"`
	Owner     bool     `json:"owner"`
	Access    MeAccess `json:"access"`
	StoreIDs  []string `json:"storeIds" nullable:"false"`
}

type UacPersonInput struct {
	Tenant string `path:"tenant"`
	UserID string `path:"userId" format:"uuid"`
}

type UacPersonOutput struct {
	Body UacPerson
}

// UacPersonChange is everything about one person, set in one transaction: nobody half set up.
type UacPersonChange struct {
	Access   MeAccess `json:"access" doc:"Each app's level, or '' for none; only the levels each app offers"`
	StoreIDs []string `json:"storeIds" nullable:"false" maxItems:"100" doc:"Exactly these of the tenant's stores"`
	Active   bool     `json:"active"`
}

type SetUacPersonInput struct {
	Tenant string `path:"tenant"`
	UserID string `path:"userId" format:"uuid"`
	Body   UacPersonChange
}

// AskAccessInput asks a tenant, by the slug in its address, to let the caller in.
type AskAccessInput struct {
	Body struct {
		Tenant string `json:"tenant" minLength:"1" maxLength:"100" doc:"The tenant's slug, from its address"`
	}
}

type UacRequestInput struct {
	Tenant string `path:"tenant"`
	ID     string `path:"id" format:"uuid"`
}

type UacRequestOutput struct {
	Body AccessRequest
}

// ApproveRequestInput lets the person in with these levels and stores, in one transaction.
type ApproveRequestInput struct {
	Tenant string `path:"tenant"`
	ID     string `path:"id" format:"uuid"`
	Body   UacPersonChange
}

type RejectRequestInput struct {
	Tenant string `path:"tenant"`
	ID     string `path:"id" format:"uuid"`
	Body   struct {
		Block bool `json:"block" doc:"Also drop this person's later asks, quietly"`
	}
}
