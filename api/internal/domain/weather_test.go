package domain

import (
	"reflect"
	"testing"
	"time"
)

// The old app's fixed point (Ciomas, Bogor), and a store a few hundred metres away.
const ciomasLat, ciomasLng = -6.60534088404916, 106.76243694791512

func at(hhmm string) time.Time {
	t, _ := time.ParseInLocation("2006-01-02 15:04", "2026-10-24 "+hhmm, WIB)
	return t
}

func TestCell(t *testing.T) {
	a := Cell(ciomasLat, ciomasLng)
	if a != "-6.60,106.75" {
		t.Fatalf("Ciomas: %s", a)
	}
	if b := Cell(-6.6031, 106.7650); b != a {
		t.Errorf("a store 300 m away: %s, want %s", b, a)
	}
	if c := Cell(-6.5950, 106.8060); c == a {
		t.Errorf("a store 5 km away shares the cell %s", c)
	}
	lat, lng, err := CellCentre(a)
	if err != nil || lat != -6.60 || lng != 106.75 {
		t.Errorf("centre of %s: %v %v %v", a, lat, lng, err)
	}
	if _, _, err := CellCentre("nonsense"); err == nil {
		t.Error("a malformed cell parsed")
	}
}

func TestCellsDue(t *testing.T) {
	near := StoreHours{Lat: ciomasLat, Lng: ciomasLng, Open: "08:00", Close: "22:00"}
	nearToo := StoreHours{Lat: -6.6031, Lng: 106.7650, Open: "09:00", Close: "21:00"}
	far := StoreHours{Lat: -6.5950, Lng: 106.8060, Open: "10:00", Close: "20:00"}
	stores := []StoreHours{near, nearToo, far}

	for _, c := range []struct {
		at   string
		want []string
	}{
		{"03:00", []string{}},                               // night: nothing
		{"06:59", []string{}},                               // more than an hour before the first opens
		{"07:00", []string{"-6.60,106.75"}},                 // the forecast before opening
		{"12:00", []string{"-6.60,106.75", "-6.60,106.80"}}, // both areas open: one fetch each
		{"20:30", []string{"-6.60,106.75"}},                 // the far store has closed
		{"22:00", []string{}},                               // everything closed
	} {
		if got := CellsDue(at(c.at), stores); !reflect.DeepEqual(got, c.want) {
			t.Errorf("%s: %v, want %v", c.at, got, c.want)
		}
	}

	late := StoreHours{Lat: ciomasLat, Lng: ciomasLng, Open: "16:00", Close: "02:00"}
	if got := CellsDue(at("23:30"), []StoreHours{late}); len(got) != 1 {
		t.Errorf("a store open past midnight: %v", got)
	}
	if got := CellsDue(at("12:00"), []StoreHours{{Lat: 1, Lng: 1, Open: "soon", Close: "22:00"}}); len(got) != 0 {
		t.Errorf("unreadable hours fetched: %v", got)
	}
}
