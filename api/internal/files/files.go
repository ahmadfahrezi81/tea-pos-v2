// Package files gives the phones signed addresses to upload photos straight to Supabase
// Storage, and to read the private ones; the photo never passes through Go. The buckets are
// the old app's, shared while both run, and so is the address format saved in rows. Task 017c.
package files

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Purpose is what a photo is for: it decides the bucket and who may upload.
type Purpose struct {
	Bucket string
	// Roles allowed to upload; empty means anyone signed in.
	Roles []string
	// Store photos are kept under their store, which must be the tenant's.
	ByStore bool
	// Private photos are read through a short-lived signed address only.
	Private bool
}

// Purposes are the old app's buckets, as they are set up (public or not) in Storage.
var Purposes = map[string]Purpose{
	"daily_photo":   {Bucket: "daily-photos", ByStore: true, Private: true},
	"report":        {Bucket: "store-reports", ByStore: true, Private: true},
	"request":       {Bucket: "store-requests", ByStore: true, Private: true},
	"reimbursement": {Bucket: "reimbursements", Private: true},
	"payroll_proof": {Bucket: "payroll-proofs", Roles: []string{"ADMIN"}, Private: true},
	"product_image": {Bucket: "product-images", Roles: []string{"ADMIN"}},
}

// MaxBytes is the buckets' own limit. The phone shrinks each photo to about 0.4 MB first.
const MaxBytes = 1 << 20

// UploadTTL is how long a signed upload address works.
const UploadTTL = 2 * time.Minute

type Storage struct {
	URL, Key string
	HTTP     *http.Client
}

func NewStorage(supabaseURL, secretKey string) *Storage {
	return &Storage{URL: strings.TrimSuffix(supabaseURL, "/"), Key: secretKey, HTTP: &http.Client{Timeout: 10 * time.Second}}
}

// Path is where a photo goes: the tenant, its store when it has one, then a name of time
// and randomness, as the old app names them. Never the phone's own file name.
func Path(tenantID, storeID, contentType string) string {
	ext := "jpg"
	if contentType == "image/webp" {
		ext = "webp"
	}
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	name := fmt.Sprintf("%d-%s.%s", time.Now().UnixMilli(), hex.EncodeToString(b), ext)
	if storeID != "" {
		return tenantID + "/" + storeID + "/" + name
	}
	return tenantID + "/" + name
}

// SignUpload is an address the phone PUTs the photo to.
func (s *Storage) SignUpload(ctx context.Context, bucket, path string) (string, error) {
	var out struct {
		URL string `json:"url"`
	}
	if err := s.post(ctx, "/object/upload/sign/"+bucket+"/"+escape(path), map[string]any{}, &out); err != nil {
		return "", err
	}
	return s.URL + "/storage/v1" + out.URL, nil
}

// SignRead is a private photo's address for a while.
func (s *Storage) SignRead(ctx context.Context, bucket, path string, ttl time.Duration) (string, error) {
	var out struct {
		SignedURL string `json:"signedURL"`
	}
	if err := s.post(ctx, "/object/sign/"+bucket+"/"+escape(path), map[string]any{"expiresIn": int(ttl.Seconds())}, &out); err != nil {
		return "", err
	}
	return s.URL + "/storage/v1" + out.SignedURL, nil
}

// SignReads signs several paths of one bucket in one call: path to address; a path Storage
// does not have is left out.
func (s *Storage) SignReads(ctx context.Context, bucket string, paths []string, ttl time.Duration) (map[string]string, error) {
	out := map[string]string{}
	if len(paths) == 0 {
		return out, nil
	}
	var signed []struct {
		Path      string  `json:"path"`
		SignedURL *string `json:"signedURL"`
	}
	if err := s.post(ctx, "/object/sign/"+bucket, map[string]any{"expiresIn": int(ttl.Seconds()), "paths": paths}, &signed); err != nil {
		return nil, err
	}
	for _, p := range signed {
		if p.SignedURL != nil {
			out[p.Path] = s.URL + "/storage/v1" + *p.SignedURL
		}
	}
	return out, nil
}

// PathIn is the path inside bucket of an address saved in a row (the old app saves the public
// form, private bucket or not); empty when the address is not that bucket's.
func PathIn(bucket, address string) string {
	for _, kind := range []string{"/object/public/", "/object/sign/", "/object/"} {
		_, rest, ok := strings.Cut(address, kind+bucket+"/")
		if !ok {
			continue
		}
		rest, _, _ = strings.Cut(rest, "?")
		if p, err := url.PathUnescape(rest); err == nil {
			return p
		}
	}
	return ""
}

// PublicURL is the address saved in a row, the old app's form, private bucket or not; a
// private photo is read through SignRead with the path taken from it.
func (s *Storage) PublicURL(bucket, path string) string {
	return s.URL + "/storage/v1/object/public/" + bucket + "/" + escape(path)
}

var ErrNotConfigured = errors.New("files: SUPABASE_SECRET_KEY is not set")

func (s *Storage) post(ctx context.Context, path string, body, out any) error {
	if s == nil || s.Key == "" {
		return ErrNotConfigured
	}
	b, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.URL+"/storage/v1"+path, bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("apikey", s.Key)
	req.Header.Set("Authorization", "Bearer "+s.Key)
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.HTTP.Do(req)
	if err != nil {
		return fmt.Errorf("storage: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("storage: status %d", resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

func escape(path string) string {
	parts := strings.Split(path, "/")
	for i, p := range parts {
		parts[i] = url.PathEscape(p)
	}
	return strings.Join(parts, "/")
}
