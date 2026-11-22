package contract

type PushKeyOutput struct {
	Body struct {
		Key string `json:"key" doc:"The VAPID public key a phone subscribes with; empty while push is off"`
	}
}

type PushSubscriptionInput struct {
	UserAgent string `header:"User-Agent"`
	Body      struct {
		Endpoint string `json:"endpoint" format:"uri" maxLength:"1000"`
		P256dh   string `json:"p256dh" maxLength:"200"`
		Auth     string `json:"auth" maxLength:"100"`
	}
}

type PushOffInput struct {
	Body struct {
		Endpoint string `json:"endpoint" format:"uri" maxLength:"1000"`
	}
}
