package contract

type FeedbacksInput struct {
	Tenant string `path:"tenant"`
	Limit  int    `query:"limit" minimum:"1" maximum:"500" default:"100"`
}

type FeedbacksOutput struct {
	Body struct {
		Feedbacks []Feedback `json:"feedbacks" nullable:"false" doc:"Newest first"`
	}
}

// Feedback is a place a customer asked for a store, written down by a seller.
type Feedback struct {
	ID              string  `json:"id" format:"uuid"`
	LocationName    string  `json:"locationName"`
	LocationDisplay string  `json:"locationDisplay"`
	Latitude        float64 `json:"latitude"`
	Longitude       float64 `json:"longitude"`
	Notes           string  `json:"notes,omitempty"`
	At              string  `json:"at" format:"date-time"`
	UserName        string  `json:"userName,omitempty"`
}

type WeatherOutput struct {
	Body struct {
		City   string        `json:"city"`
		Region string        `json:"region"`
		Hours  []WeatherHour `json:"hours" nullable:"false" doc:"Yesterday to tomorrow, by hour, in WIB"`
	}
}

type WeatherHour struct {
	Date        string  `json:"date" format:"date"`
	Hour        int     `json:"hour" minimum:"0" maximum:"23"`
	Temperature float64 `json:"temperature" doc:"°C"`
	RainChance  float64 `json:"rainChance" doc:"%"`
	Code        int     `json:"code" doc:"Tomorrow.io's weather code"`
	FetchedAt   string  `json:"fetchedAt" format:"date-time"`
}
