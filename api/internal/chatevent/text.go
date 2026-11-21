package chatevent

import (
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"
)

// Text is an event in lang ("en" or "id"): the body kept for old builds, and the push. The
// phone's own copy is packages/chat/events.ts; the two say the same.
func Text(event string, d map[string]any, lang string) string {
	en := lang == "en"
	pick := func(e, i string) string {
		if en {
			return e
		}
		return i
	}
	switch event {
	case DaySummary:
		cups := num(d["cups"])
		s := pick("📊 Today: ", "📊 Hari ini: ") + count(cups) + " cups · " + Money(num(d["sales"]))
		if prev, ok := d["prevCups"]; ok && prev != nil {
			diff := cups - num(prev)
			s += " · " + signed(diff) + pick(" cups on yesterday", " cups dari kemarin")
		}
		if avg, ok := d["avgCups"]; ok && avg != nil && num(avg) > 0 {
			pct := math.Round((cups - num(avg)) / num(avg) * 100)
			switch {
			case pct > 0:
				s += " · " + count(pct) + pick("% above the 7-day average", "% di atas rata-rata 7 hari")
			case pct < 0:
				s += " · " + count(-pct) + pick("% below the 7-day average", "% di bawah rata-rata 7 hari")
			default:
				s += pick(" · on the 7-day average", " · sama dengan rata-rata 7 hari")
			}
		}
		return s
	case RainStarted:
		return pick("🌧 Rain likely in the next 2 hours (", "🌧 Kemungkinan hujan dalam 2 jam ke depan (") + count(num(d["chance"])) + "%)"
	case RainStopped:
		return pick("☀️ Rain chance down to ", "☀️ Peluang hujan turun ke ") + count(num(d["chance"])) + "%"
	case PayoutPaid:
		period := Period(str(d["start"]), str(d["end"]), lang)
		total := Money(num(d["total"]))
		if d["vip"] == true {
			return fmt.Sprintf(pick("💰 %s paid %s %s for %s", "💰 %s membayar %s %s untuk %s"), str(d["payer"]), str(d["name"]), total, period)
		}
		return fmt.Sprintf(pick("💰 Your pay for %s was paid: %s", "💰 Gaji kamu untuk %s sudah dibayar: %s"), period, total)
	case PayTotal:
		period := Period(str(d["start"]), str(d["end"]), lang)
		return fmt.Sprintf(pick("💼 Pay for %s: %s for %s people", "💼 Gaji %s: %s untuk %s orang"), period, Money(num(d["total"])), count(num(d["people"])))
	case Release:
		return pick("🎉 What's new in ", "🎉 Yang baru di ") + str(d["version"])
	}
	return ""
}

var monthsID = [...]string{"Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"}

// Period is "17–23 Nov", or "28 Okt–3 Nov" across a month.
func Period(start, end, lang string) string {
	a, errA := time.Parse(time.DateOnly, start)
	b, errB := time.Parse(time.DateOnly, end)
	if errA != nil || errB != nil {
		return start + "–" + end
	}
	month := func(t time.Time) string {
		if lang == "en" {
			return t.Format("Jan")
		}
		return monthsID[t.Month()-1]
	}
	if a.Month() == b.Month() {
		return fmt.Sprintf("%d–%d %s", a.Day(), b.Day(), month(b))
	}
	return fmt.Sprintf("%d %s–%d %s", a.Day(), month(a), b.Day(), month(b))
}

// Money is "Rp 1.420.000", as the apps write it.
func Money(n float64) string {
	if n < 0 {
		return "-Rp " + count(-n)
	}
	return "Rp " + count(n)
}

// count is 6.203: a dot between thousands, whatever the language.
func count(n float64) string {
	s := strconv.FormatInt(int64(math.Round(n)), 10)
	neg := strings.HasPrefix(s, "-")
	s = strings.TrimPrefix(s, "-")
	var b strings.Builder
	for i, r := range s {
		if i > 0 && (len(s)-i)%3 == 0 {
			b.WriteByte('.')
		}
		b.WriteRune(r)
	}
	if neg {
		return "-" + b.String()
	}
	return b.String()
}

func signed(n float64) string {
	if n > 0 {
		return "+" + count(n)
	}
	if n < 0 {
		return "−" + count(-n)
	}
	return "±0"
}

func num(v any) float64 {
	switch x := v.(type) {
	case float64:
		return x
	case int:
		return float64(x)
	case int64:
		return float64(x)
	case int32:
		return float64(x)
	}
	return 0
}

func str(v any) string {
	s, _ := v.(string)
	return s
}
