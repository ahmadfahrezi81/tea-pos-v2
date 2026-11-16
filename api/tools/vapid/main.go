// Prints a new VAPID key pair for Web Push, to put in Infisical as VAPID_PUBLIC_KEY and
// VAPID_PRIVATE_KEY (staging and prod each their own). Run: cd api && go run ./tools/vapid
package main

import (
	"fmt"
	"os"

	webpush "github.com/SherClockHolmes/webpush-go"
)

func main() {
	private, public, err := webpush.GenerateVAPIDKeys()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Printf("VAPID_PUBLIC_KEY=%s\nVAPID_PRIVATE_KEY=%s\n", public, private)
}
