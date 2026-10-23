package auth

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

// Supabase does the Google exchange only; Go keeps no Supabase token afterwards.
type Supabase struct {
	URL  string
	Key  string // the publishable key
	HTTP *http.Client
}

func NewSupabase(baseURL, key string) Supabase {
	return Supabase{URL: baseURL, Key: key, HTTP: &http.Client{Timeout: 10 * time.Second}}
}

// NewPKCE makes the verifier (kept in a short cookie) and its challenge (sent to Supabase).
func NewPKCE() (verifier, challenge string) {
	raw := make([]byte, 32)
	_, _ = rand.Read(raw)
	verifier = base64.RawURLEncoding.EncodeToString(raw)
	sum := sha256.Sum256([]byte(verifier))
	return verifier, base64.RawURLEncoding.EncodeToString(sum[:])
}

// AuthorizeURL starts Google sign-in; Supabase sends the user back to redirectTo with a code.
func (s Supabase) AuthorizeURL(redirectTo, challenge string) string {
	q := url.Values{
		"provider":              {"google"},
		"redirect_to":           {redirectTo},
		"code_challenge":        {challenge},
		"code_challenge_method": {"s256"},
		// Always ask which account: a shared phone may hold several.
		"prompt": {"select_account"},
	}
	return s.URL + "/auth/v1/authorize?" + q.Encode()
}

type SupabaseUser struct {
	ID       string `json:"id"`
	Email    string `json:"email"`
	Metadata struct {
		AvatarURL string `json:"avatar_url"`
	} `json:"user_metadata"`
}

// Exchange trades the code and verifier for the signed-in user.
func (s Supabase) Exchange(ctx context.Context, code, verifier string) (SupabaseUser, error) {
	body, _ := json.Marshal(map[string]string{"auth_code": code, "code_verifier": verifier})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.URL+"/auth/v1/token?grant_type=pkce", bytes.NewReader(body))
	if err != nil {
		return SupabaseUser{}, err
	}
	req.Header.Set("apikey", s.Key)
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.HTTP.Do(req)
	if err != nil {
		return SupabaseUser{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return SupabaseUser{}, fmt.Errorf("supabase token exchange: status %d", resp.StatusCode)
	}
	var out struct {
		User SupabaseUser `json:"user"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return SupabaseUser{}, err
	}
	if out.User.ID == "" {
		return SupabaseUser{}, fmt.Errorf("supabase token exchange: no user")
	}
	return out.User, nil
}
