package service

import (
	"encoding/base64"
	"strings"
	"testing"
)

// Unit-Tests zu REQ-75-AC1 und REQ-75-AC2 (Ticket #75): Fortsetzungsmarke der Blogübersicht.
// Die Marke trägt Veröffentlichungsdatum und ID des letzten Eintrags einer Portion; ungültige Werte
// werden abgewiesen statt stillschweigend am Anfang fortzusetzen.

func TestREQ75SeitengroesseIstZwanzig(t *testing.T) {
	if PostsPageSize != 20 {
		t.Fatalf("PostsPageSize = %d, erwartet 20 laut Ticket #75", PostsPageSize)
	}
}

func TestREQ75CursorHinUndZurueck(t *testing.T) {
	for _, tc := range []struct {
		at string
		id int64
	}{
		{"2026-11-03T09:00:00Z", 1},
		{"2026-11-03T09:00:00Z", 9_007_199_254_740_993},
		{"2026-01-01 00:00:00", 42}, // Altformat aus SQLite-Testdaten
	} {
		c := encodeCursor(tc.at, tc.id)
		if strings.ContainsAny(c, "+/=") {
			t.Errorf("Marke %q ist nicht URL-sicher", c)
		}
		at, id, err := decodeCursor(c)
		if err != nil || at != tc.at || id != tc.id {
			t.Errorf("decodeCursor(encodeCursor(%q, %d)) = %q, %d, %v", tc.at, tc.id, at, id, err)
		}
	}
}

func TestREQ75UngueltigerCursor(t *testing.T) {
	b := func(s string) string { return base64.RawURLEncoding.EncodeToString([]byte(s)) }
	for name, c := range map[string]string{
		"leer":              "",
		"kein Base64":       "!!!",
		"ohne Trenner":      b("2026-11-03T09:00:00Z"),
		"ID keine Zahl":     b("2026-11-03T09:00:00Z|abc"),
		"ID null":           b("2026-11-03T09:00:00Z|0"),
		"ID negativ":        b("2026-11-03T09:00:00Z|-3"),
		"Datum leer":        b("|7"),
		"Datum kein Datum":  b("gestern|7"),
		"Standard-Base64":   base64.StdEncoding.EncodeToString([]byte("2026-11-03T09:00:00Z|7")),
		"überlang":          b(strings.Repeat("9", 300) + "|7"),
	} {
		if _, _, err := decodeCursor(c); err == nil {
			t.Errorf("%s: Marke %q wurde akzeptiert", name, c)
		}
	}
}
