package linkedin

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"
)

// Unit-Tests zu Ticket #85 (LinkedIn-Anbindung). Sollwerte aus der Spezifikation REQ-85 und der LinkedIn-Dokumentation
// (OAuth 2.0 Authorization Code Flow, OpenID-Userinfo, Posts API mit Little-Text-Format).

const secretToken = "geheimes-token-85"

func newTestClient(t *testing.T, h http.HandlerFunc) *Client {
	t.Helper()
	srv := httptest.NewServer(h)
	t.Cleanup(srv.Close)
	return New(Config{
		ClientID: "client-85", ClientSecret: "secret-85", RedirectURL: "https://example.test/api/admin/social/linkedin/callback",
		AuthBaseURL: srv.URL, APIBaseURL: srv.URL, Timeout: 500 * time.Millisecond,
	})
}

func TestREQ85AC1AutorisierungsadresseFuerPersoenlichesProfil(t *testing.T) {
	c := New(Config{ClientID: "client-85", ClientSecret: "s", RedirectURL: "https://example.test/cb", AuthBaseURL: "https://www.linkedin.com"})
	u, err := url.Parse(c.AuthorizationURL("zustand-1"))
	if err != nil {
		t.Fatal(err)
	}
	if u.Host != "www.linkedin.com" || u.Path != "/oauth/v2/authorization" {
		t.Errorf("Adresse %s, erwartet www.linkedin.com/oauth/v2/authorization", u)
	}
	q := u.Query()
	want := map[string]string{
		"response_type": "code", "client_id": "client-85", "redirect_uri": "https://example.test/cb",
		"state": "zustand-1", "scope": "openid profile w_member_social",
	}
	for k, v := range want {
		if q.Get(k) != v {
			t.Errorf("Parameter %s = %q, erwartet %q", k, q.Get(k), v)
		}
	}
}

func TestREQ85AC2OhneClientIDNichtKonfiguriert(t *testing.T) {
	if New(Config{ClientSecret: "s"}).Configured() {
		t.Error("ohne Client-ID darf die App nicht als konfiguriert gelten")
	}
	if New(Config{ClientID: "c"}).Configured() {
		t.Error("ohne Client-Secret darf die App nicht als konfiguriert gelten")
	}
	if !New(Config{ClientID: "c", ClientSecret: "s"}).Configured() {
		t.Error("mit Client-ID und Secret ist die App konfiguriert")
	}
}

func TestREQ85AC1CodeGegenTokenTauschenUndProfilLesen(t *testing.T) {
	now := time.Date(2026, 11, 18, 10, 0, 0, 0, time.UTC)
	c := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/oauth/v2/accessToken":
			if r.Method != http.MethodPost {
				t.Errorf("Methode %s", r.Method)
			}
			_ = r.ParseForm()
			for k, v := range map[string]string{"grant_type": "authorization_code", "code": "code-1", "client_id": "client-85",
				"client_secret": "secret-85", "redirect_uri": "https://example.test/api/admin/social/linkedin/callback"} {
				if r.PostForm.Get(k) != v {
					t.Errorf("Formularfeld %s = %q, erwartet %q", k, r.PostForm.Get(k), v)
				}
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"access_token": secretToken, "expires_in": 5184000})
		case "/v2/userinfo":
			if r.Header.Get("Authorization") != "Bearer "+secretToken {
				t.Errorf("Authorization %q", r.Header.Get("Authorization"))
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"sub": "abc123", "name": "Marvin Jakob"})
		default:
			http.NotFound(w, r)
		}
	})
	c.now = func() time.Time { return now }
	tok, err := c.Exchange(context.Background(), "code-1")
	if err != nil {
		t.Fatal(err)
	}
	if tok.AccessToken != secretToken || !tok.ExpiresAt.Equal(now.Add(60*24*time.Hour)) {
		t.Errorf("Token %+v, erwartet Ablauf nach 60 Tagen", tok)
	}
	p, err := c.Profile(context.Background(), tok.AccessToken)
	if err != nil {
		t.Fatal(err)
	}
	if p.ID != "abc123" || p.Name != "Marvin Jakob" {
		t.Errorf("Profil %+v", p)
	}
}

func TestREQ85AC5FehlerBeimTokentauschEnthaltenKeinGeheimnis(t *testing.T) {
	c := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = io.WriteString(w, `{"error":"invalid_request","error_description":"secret-85 `+secretToken+`"}`)
	})
	_, err := c.Exchange(context.Background(), "code-1")
	if err == nil {
		t.Fatal("abgelehnter Tokentausch muss scheitern")
	}
	if strings.Contains(err.Error(), secretToken) || strings.Contains(err.Error(), "secret-85") {
		t.Errorf("Fehlermeldung enthält Geheimnis: %v", err)
	}
}

func TestREQ85AC6PostMitTitelUndLinkAnlegen(t *testing.T) {
	var body map[string]any
	c := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/rest/posts" {
			t.Errorf("Aufruf %s %s, erwartet POST /rest/posts", r.Method, r.URL.Path)
		}
		for k, v := range map[string]string{"Authorization": "Bearer " + secretToken, "X-Restli-Protocol-Version": "2.0.0",
			"Content-Type": "application/json"} {
			if r.Header.Get(k) != v {
				t.Errorf("Header %s = %q, erwartet %q", k, r.Header.Get(k), v)
			}
		}
		if len(r.Header.Get("LinkedIn-Version")) != 6 {
			t.Errorf("LinkedIn-Version %q, erwartet JJJJMM", r.Header.Get("LinkedIn-Version"))
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		w.Header().Set("x-restli-id", "urn:li:share:7000")
		w.WriteHeader(http.StatusCreated)
	})
	urn, err := c.CreatePost(context.Background(), secretToken, Post{AuthorID: "abc123", Title: "KI im Alltag", URL: "https://example.test/de/blog/ki-im-alltag"})
	if err != nil {
		t.Fatal(err)
	}
	if urn != "urn:li:share:7000" {
		t.Errorf("URN %q", urn)
	}
	if body["author"] != "urn:li:person:abc123" || body["visibility"] != "PUBLIC" || body["lifecycleState"] != "PUBLISHED" {
		t.Errorf("Autor, Sichtbarkeit oder Status falsch: %v", body)
	}
	if body["commentary"] != "KI im Alltag\n\nhttps://example.test/de/blog/ki-im-alltag" {
		t.Errorf("Text %q, erwartet Titel und Link", body["commentary"])
	}
	article, _ := body["content"].(map[string]any)["article"].(map[string]any)
	if article["source"] != "https://example.test/de/blog/ki-im-alltag" || article["title"] != "KI im Alltag" {
		t.Errorf("Artikelvorschau %v", article)
	}
	dist, _ := body["distribution"].(map[string]any)
	if dist["feedDistribution"] != "MAIN_FEED" {
		t.Errorf("Verteilung %v", dist)
	}
}

func TestREQ85AC6TitelImLittleTextFormatMaskieren(t *testing.T) {
	got := Commentary(`KI (neu) [2026] #1 @Team *fett* _kursiv_ ~x~ <a> {b} |c| \d`, "https://example.test/de/blog/x")
	want := `KI \(neu\) \[2026\] \#1 \@Team \*fett\* \_kursiv\_ \~x\~ \<a\> \{b\} \|c\| \\d` + "\n\nhttps://example.test/de/blog/x"
	if got != want {
		t.Errorf("Commentary\n got %q\nwant %q", got, want)
	}
}

func TestREQ85AC8LinkZumPost(t *testing.T) {
	if got := PostURL("urn:li:share:7000"); got != "https://www.linkedin.com/feed/update/urn:li:share:7000/" {
		t.Errorf("PostURL %q", got)
	}
}

func TestREQ85AC12AblehnungMitStatusIstEindeutig(t *testing.T) {
	for _, status := range []int{400, 401, 403, 422, 429} {
		c := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(status)
			_, _ = io.WriteString(w, `{"message":"`+secretToken+`"}`)
		})
		_, err := c.CreatePost(context.Background(), secretToken, Post{AuthorID: "a", Title: "T", URL: "https://example.test/de/blog/t"})
		var rej *RejectedError
		if !errors.As(err, &rej) || rej.Status != status {
			t.Errorf("Status %d: Fehler %v, erwartet RejectedError", status, err)
		}
		if errors.Is(err, ErrUnknownOutcome) {
			t.Errorf("Status %d darf nicht als unklarer Ausgang gelten", status)
		}
		if err != nil && strings.Contains(err.Error(), secretToken) {
			t.Errorf("Status %d: Fehlermeldung enthält das Token", status)
		}
	}
}

func TestREQ85AC13UnklarerAusgang(t *testing.T) {
	cases := map[string]http.HandlerFunc{
		"5xx": func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusBadGateway) },
		"Timeout": func(w http.ResponseWriter, r *http.Request) {
			select {
			case <-time.After(2 * time.Second):
			case <-r.Context().Done():
			}
		},
		"Verbindungsabbruch": func(w http.ResponseWriter, r *http.Request) {
			conn, _, err := w.(http.Hijacker).Hijack()
			if err == nil {
				conn.Close()
			}
		},
		"201 ohne Kennung": func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusCreated) },
	}
	for name, h := range cases {
		t.Run(name, func(t *testing.T) {
			c := newTestClient(t, h)
			_, err := c.CreatePost(context.Background(), secretToken, Post{AuthorID: "a", Title: "T", URL: "https://example.test/de/blog/t"})
			if !errors.Is(err, ErrUnknownOutcome) {
				t.Errorf("Fehler %v, erwartet ErrUnknownOutcome", err)
			}
			var rej *RejectedError
			if errors.As(err, &rej) {
				t.Errorf("unklarer Ausgang darf nicht als Ablehnung gelten")
			}
			if err != nil && strings.Contains(err.Error(), secretToken) {
				t.Errorf("Fehlermeldung enthält das Token")
			}
		})
	}
}
