// Prints the API contract; `pnpm --filter @tea-pos/api generate` writes it to openapi.yaml.
package main

import (
	"fmt"
	"net/http"
	"os"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/handler"
)

func main() {
	spec, err := handler.NewAPI(http.NewServeMux(), handler.Deps{}).OpenAPI().YAML()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	os.Stdout.Write(spec)
}
