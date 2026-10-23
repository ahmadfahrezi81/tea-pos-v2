package handler

import (
	"context"

	"github.com/danielgtaylor/huma/v2"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/auth"
)

// route registers op with who may call it. Every route goes through here, never huma.Register.
func route[I, O any](api huma.API, op huma.Operation, access auth.Access, h func(context.Context, *I) (*O, error)) {
	auth.Declare(&op, access)
	huma.Register(api, op, h)
}
