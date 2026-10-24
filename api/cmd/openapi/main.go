// Prints the API contract; `pnpm --filter @tea-pos/api generate` writes it to openapi.yaml.
package main

import (
	"fmt"
	"net/http"
	"os"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/handler"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/httpx"
)

func main() {
	oapi := handler.NewAPI(http.NewServeMux(), handler.Deps{}).OpenAPI()
	// Every code the API can send, so the apps' typecheck fails on one they do not translate.
	codes := httpx.Codes()
	enum := make([]any, len(codes))
	for i, c := range codes {
		enum[i] = c
	}
	oapi.Components.Schemas.Map()["Error"].Properties["code"].Enum = enum
	spec, err := oapi.YAML()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	os.Stdout.Write(spec)
}
