package contract

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
