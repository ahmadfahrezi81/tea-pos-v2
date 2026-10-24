package handler

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"slices"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/auth"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/files"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
)

func registerFiles(api huma.API, d Deps) {
	route(api, huma.Operation{
		OperationID: "signUpload",
		Method:      http.MethodPost,
		Path:        "/tenants/{tenant}/files",
		Summary:     "An address to upload one photo to, straight to Storage",
		Tags:        []string{"files"},
	}, auth.SignedIn.InTenant().Repeatable(), func(ctx context.Context, in *contract.UploadInput) (*contract.UploadOutput, error) {
		caller, _ := auth.CallerFrom(ctx)
		p := files.Purposes[in.Body.Purpose]
		if len(p.Roles) > 0 && !slices.Contains(p.Roles, caller.Role) {
			return nil, errNotAllowed
		}
		if p.ByStore != (in.Body.StoreID != "") {
			return nil, errStoreRequired
		}
		if p.ByStore {
			var id pgtype.UUID
			if err := id.Scan(in.Body.StoreID); err != nil {
				return nil, errNotAStore
			}
			ok, err := d.Queries.StoreInTenant(ctx, store.StoreInTenantParams{ID: id, TenantID: caller.TenantID})
			if err != nil {
				return nil, err
			}
			if !ok {
				return nil, errStoreNotFound
			}
		}

		path := files.Path(caller.TenantID.String(), in.Body.StoreID, in.Body.ContentType)
		upload, err := d.Files.SignUpload(ctx, p.Bucket, path)
		if errors.Is(err, files.ErrNotConfigured) {
			return nil, errFilesOff
		}
		if err != nil {
			slog.ErrorContext(ctx, "sign upload", "err", err, "bucket", p.Bucket)
			return nil, errFilesFailed
		}
		out := &contract.UploadOutput{}
		out.Body.UploadURL, out.Body.Path, out.Body.URL = upload, path, d.Files.PublicURL(p.Bucket, path)
		return out, nil
	})
}
