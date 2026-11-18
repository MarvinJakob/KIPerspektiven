// Package linkedin spricht die LinkedIn-Schnittstellen für das automatische Teilen von Beiträgen an (Ticket #85):
// OAuth 2.0 (Authorization Code Flow) für ein persönliches Profil, OpenID-Userinfo und die Posts API.
//
// Fehler enthalten nie Zugriffstoken, Client-Secret oder Antworttexte von LinkedIn (REQ-85-AC5).
package linkedin

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Version ist die Version der LinkedIn-REST-Schnittstelle (Header LinkedIn-Version, Format JJJJMM).
const Version = "202609"

// Scopes: Anmeldung per OpenID Connect (Profil-ID und Name) und Schreibzugriff für Posts des Mitglieds.
const Scopes = "openid profile w_member_social"

// ErrUnknownOutcome bedeutet: Ob LinkedIn den Post angelegt hat, ist unklar (Timeout, Verbindungsabbruch, 5xx,
// Antwort ohne Kennung). Ein solcher Versand darf nicht wiederholt werden (REQ-85-AC13).
var ErrUnknownOutcome = errors.New("ausgang bei linkedin unklar")

// RejectedError bedeutet: LinkedIn hat die Anfrage eindeutig abgelehnt (4xx); es ist kein Post entstanden.
type RejectedError struct{ Status int }

func (e *RejectedError) Error() string {
	return fmt.Sprintf("linkedin lehnt die anfrage ab (status %d)", e.Status)
}

// Config enthält die Zugangsdaten der LinkedIn-App und die Adressen der Schnittstellen.
type Config struct {
	ClientID, ClientSecret string
	RedirectURL            string
	AuthBaseURL            string        // Standard https://www.linkedin.com
	APIBaseURL             string        // Standard https://api.linkedin.com
	Timeout                time.Duration // Standard 15 s
}

// Client ruft LinkedIn auf.
type Client struct {
	cfg  Config
	http *http.Client
	now  func() time.Time
}

// New erzeugt einen Client. Fehlende Adressen werden durch die LinkedIn-Adressen ersetzt.
func New(cfg Config) *Client {
	if cfg.AuthBaseURL == "" {
		cfg.AuthBaseURL = "https://www.linkedin.com"
	}
	if cfg.APIBaseURL == "" {
		cfg.APIBaseURL = "https://api.linkedin.com"
	}
	if cfg.Timeout == 0 {
		cfg.Timeout = 15 * time.Second
	}
	cfg.AuthBaseURL = strings.TrimRight(cfg.AuthBaseURL, "/")
	cfg.APIBaseURL = strings.TrimRight(cfg.APIBaseURL, "/")
	return &Client{cfg: cfg, http: &http.Client{Timeout: cfg.Timeout}, now: time.Now}
}

// Configured meldet, ob Client-ID und Secret der LinkedIn-App gesetzt sind (REQ-85-AC2).
func (c *Client) Configured() bool { return c.cfg.ClientID != "" && c.cfg.ClientSecret != "" }

// AuthorizationURL ist die Adresse, an der die Person LinkedIn den Zugriff erlaubt.
func (c *Client) AuthorizationURL(state string) string {
	q := url.Values{
		"response_type": {"code"},
		"client_id":     {c.cfg.ClientID},
		"redirect_uri":  {c.cfg.RedirectURL},
		"state":         {state},
		"scope":         {Scopes},
	}
	return c.cfg.AuthBaseURL + "/oauth/v2/authorization?" + q.Encode()
}

// Token ist ein Zugriffstoken mit Ablaufzeitpunkt.
type Token struct {
	AccessToken string
	ExpiresAt   time.Time
}

// Exchange tauscht den Autorisierungscode gegen ein Zugriffstoken.
func (c *Client) Exchange(ctx context.Context, code string) (Token, error) {
	form := url.Values{
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"client_id":     {c.cfg.ClientID},
		"client_secret": {c.cfg.ClientSecret},
		"redirect_uri":  {c.cfg.RedirectURL},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.cfg.AuthBaseURL+"/oauth/v2/accessToken", strings.NewReader(form.Encode()))
	if err != nil {
		return Token{}, errors.New("linkedin-tokentausch vorbereiten fehlgeschlagen")
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	var out struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int64  `json:"expires_in"`
	}
	if err := c.doJSON(req, &out); err != nil {
		return Token{}, fmt.Errorf("linkedin-tokentausch: %w", err)
	}
	if out.AccessToken == "" || out.ExpiresIn <= 0 {
		return Token{}, errors.New("linkedin-tokentausch: antwort ohne token")
	}
	return Token{AccessToken: out.AccessToken, ExpiresAt: c.now().UTC().Add(time.Duration(out.ExpiresIn) * time.Second).Truncate(time.Second)}, nil
}

// Profile ist das verbundene LinkedIn-Mitglied.
type Profile struct{ ID, Name string }

// Profile liest Kennung und Namen des Mitglieds, dem das Token gehört.
func (c *Client) Profile(ctx context.Context, token string) (Profile, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.cfg.APIBaseURL+"/v2/userinfo", nil)
	if err != nil {
		return Profile{}, errors.New("linkedin-profil vorbereiten fehlgeschlagen")
	}
	req.Header.Set("Authorization", "Bearer "+token)
	var out struct {
		Sub  string `json:"sub"`
		Name string `json:"name"`
	}
	if err := c.doJSON(req, &out); err != nil {
		return Profile{}, fmt.Errorf("linkedin-profil: %w", err)
	}
	if out.Sub == "" {
		return Profile{}, errors.New("linkedin-profil: antwort ohne kennung")
	}
	return Profile{ID: out.Sub, Name: out.Name}, nil
}

// doJSON sendet die Anfrage und liest eine JSON-Antwort mit Status 200. Fehler nennen nur den Status.
func (c *Client) doJSON(req *http.Request, out any) error {
	resp, err := c.http.Do(req)
	if err != nil {
		return errors.New("keine antwort")
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 64<<10))
		return &RejectedError{Status: resp.StatusCode}
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 64<<10)).Decode(out); err != nil {
		return errors.New("ungültige antwort")
	}
	return nil
}

// Post ist ein zu teilender Beitrag: Titel und Link der öffentlichen Sprachfassung.
type Post struct {
	AuthorID string // Kennung des Mitglieds (sub)
	Title    string
	URL      string
}

// CreatePost legt einen öffentlichen Post mit Titel, Link und Linkvorschau an und liefert seine URN.
// Eine Ablehnung (4xx) liefert *RejectedError, alle anderen Fehler ErrUnknownOutcome.
func (c *Client) CreatePost(ctx context.Context, token string, p Post) (string, error) {
	body := map[string]any{
		"author":     "urn:li:person:" + p.AuthorID,
		"commentary": Commentary(p.Title, p.URL),
		"visibility": "PUBLIC",
		"distribution": map[string]any{
			"feedDistribution":               "MAIN_FEED",
			"targetEntities":                 []any{},
			"thirdPartyDistributionChannels": []any{},
		},
		"content":                   map[string]any{"article": map[string]any{"source": p.URL, "title": p.Title}},
		"lifecycleState":            "PUBLISHED",
		"isReshareDisabledByAuthor": false,
	}
	raw, err := json.Marshal(body)
	if err != nil {
		return "", &RejectedError{Status: 0}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.cfg.APIBaseURL+"/rest/posts", strings.NewReader(string(raw)))
	if err != nil {
		return "", &RejectedError{Status: 0}
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("LinkedIn-Version", Version)
	req.Header.Set("X-Restli-Protocol-Version", "2.0.0")
	resp, err := c.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("keine antwort: %w", ErrUnknownOutcome)
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 64<<10))
	switch {
	case resp.StatusCode == http.StatusCreated:
		if id := resp.Header.Get("X-Restli-Id"); id != "" {
			return id, nil
		}
		return "", fmt.Errorf("antwort ohne kennung: %w", ErrUnknownOutcome)
	case resp.StatusCode >= 400 && resp.StatusCode < 500:
		return "", &RejectedError{Status: resp.StatusCode}
	}
	return "", fmt.Errorf("status %d: %w", resp.StatusCode, ErrUnknownOutcome)
}

// littleText maskiert die reservierten Zeichen des LinkedIn-Little-Text-Formats.
var littleText = strings.NewReplacer(
	`\`, `\\`, `|`, `\|`, `{`, `\{`, `}`, `\}`, `@`, `\@`, `[`, `\[`, `]`, `\]`, `(`, `\(`, `)`, `\)`,
	`<`, `\<`, `>`, `\>`, `#`, `\#`, `*`, `\*`, `_`, `\_`, `~`, `\~`,
)

// Commentary ist der Text des Posts: maskierter Titel, Leerzeile, Link.
func Commentary(title, link string) string {
	return littleText.Replace(title) + "\n\n" + link
}

// PostURL ist die Adresse eines Posts auf LinkedIn.
func PostURL(urn string) string {
	return "https://www.linkedin.com/feed/update/" + urn + "/"
}
