package httpserver

import (
	"context"
	"io"
	"log/slog"
	"path/filepath"
	"testing"
	"time"

	"ki-web/backend/internal/api"
	"ki-web/backend/internal/service"
	"ki-web/backend/internal/store"
)

// Ticket #138: Diese Tests rufen den Login-Handler direkt auf und halten die Passwortprüfung mit einer
// Testbarriere an. So lässt sich deterministisch zählen, wie viele parallele Anfragen die teure
// Argon2-Prüfung erreichen, bevor die erste ein Ergebnis hat.

const (
	loginTestEmail    = "redakteurin@example.test"
	loginTestPassword = "sicheres-passwort-1"
	loginTestWrong    = "falsches-passwort"
	loginTestUnknown  = "niemand@example.test"
)

// newLoginTestServer baut die API-Handler mit echter Datenbank, echtem Konto und echter Passwortprüfung.
func newLoginTestServer(t *testing.T) *apiServer {
	t.Helper()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	db, err := store.Open(filepath.Join(t.TempDir(), "login.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	if err := store.Migrate(context.Background(), db, false, log); err != nil {
		t.Fatal(err)
	}
	accounts := service.NewAccounts(db)
	if _, err := accounts.CreateUser(context.Background(), loginTestEmail, loginTestPassword, service.RoleEditor); err != nil {
		t.Fatal(err)
	}
	return newAPIServer(Config{Accounts: accounts, Log: log})
}

// loginBarrier hält jede Passwortprüfung an, bis der Test sie freigibt.
type loginBarrier struct {
	arrived chan struct{} // ein Eintrag je Anfrage, die die Passwortprüfung erreicht hat
	release chan struct{} // close gibt alle angehaltenen und folgenden Prüfungen frei
}

func holdPasswordChecks(s *apiServer) *loginBarrier {
	b := &loginBarrier{arrived: make(chan struct{}, 1000), release: make(chan struct{})}
	next := s.login
	s.login = func(ctx context.Context, email, password string) (service.Session, error) {
		b.arrived <- struct{}{}
		<-b.release
		return next(ctx, email, password)
	}
	return b
}

// loginResult ist das Ergebnis eines direkten Aufrufs des Login-Handlers.
type loginResult struct {
	resp api.LoginResponseObject
	err  error
}

// tryLogin ruft den Login-Handler so auf, als käme die Anfrage von ip.
func tryLogin(ctx context.Context, s *apiServer, ip, email, password string) loginResult {
	ctx = context.WithValue(ctx, clientIPKey, ip)
	resp, err := s.Login(ctx, api.LoginRequestObject{Body: &api.LoginJSONRequestBody{Email: email, Password: password}})
	return loginResult{resp, err}
}

// startLogins startet n Anmeldeversuche gleichzeitig. Die Ergebnisse kommen über den Kanal.
func startLogins(s *apiServer, n int, ip func(i int) string, email, password string) <-chan loginResult {
	results := make(chan loginResult, n)
	for i := range n {
		go func() { results <- tryLogin(context.Background(), s, ip(i), email, password) }()
	}
	return results
}

// waitAdmission wartet, bis jeder von n Versuchen entweder die (angehaltene) Passwortprüfung erreicht oder
// bereits eine Antwort erhalten hat. Angehaltene Versuche antworten erst nach der Freigabe.
func waitAdmission(t *testing.T, b *loginBarrier, results <-chan loginResult, n int) (admitted int, early []loginResult) {
	t.Helper()
	timeout := time.After(10 * time.Second)
	for admitted+len(early) < n {
		select {
		case <-b.arrived:
			admitted++
		case r := <-results:
			early = append(early, r)
		case <-timeout:
			t.Fatalf("nach 10 s: %d Versuche in der Passwortprüfung, %d beantwortet, erwartet zusammen %d", admitted, len(early), n)
		}
	}
	return admitted, early
}

// collect liest n weitere Ergebnisse.
func collect(t *testing.T, results <-chan loginResult, n int) []loginResult {
	t.Helper()
	out := make([]loginResult, 0, n)
	timeout := time.After(30 * time.Second)
	for len(out) < n {
		select {
		case r := <-results:
			out = append(out, r)
		case <-timeout:
			t.Fatalf("nach 30 s erst %d von %d Antworten", len(out), n)
		}
	}
	return out
}

// sameIP lässt alle Versuche von derselben IP-Adresse kommen.
func sameIP(int) string { return testIP }

const testIP = "203.0.113.7"

// Ticket #138: Parallele Versuche derselben IP dürfen zusammen nicht mehr Passwortprüfungen erreichen, als
// Fehlversuche erlaubt sind. Vor der Korrektur passierten alle elf die Zulassung, weil ein Fehlversuch erst
// nach der Argon2-Prüfung gezählt wurde.
func TestParallelLoginsFromOneIPAreLimitedBeforePasswordCheck(t *testing.T) {
	s := newLoginTestServer(t)
	b := holdPasswordChecks(s)
	const n = loginMaxFailures + 1
	results := startLogins(s, n, sameIP, loginTestEmail, loginTestWrong)

	admitted, early := waitAdmission(t, b, results, n)
	if admitted != loginMaxFailures {
		t.Fatalf("%d parallele Passwortprüfungen zugelassen, erwartet höchstens %d", admitted, loginMaxFailures)
	}
	for _, r := range early {
		if _, ok := r.resp.(api.Login429JSONResponse); !ok || r.err != nil {
			t.Errorf("überzähliger Versuch: %T (%v), erwartet 429", r.resp, r.err)
		}
	}

	close(b.release)
	for _, r := range collect(t, results, admitted) {
		if _, ok := r.resp.(api.Login401JSONResponse); !ok || r.err != nil {
			t.Errorf("zugelassener Versuch: %T (%v), erwartet 401", r.resp, r.err)
		}
	}
	// Die zehn Fehlversuche sind gezählt: Auch das richtige Passwort wird jetzt vor der Prüfung abgewiesen.
	if r := tryLogin(context.Background(), s, testIP, loginTestEmail, loginTestPassword); !is429(r) {
		t.Errorf("nach %d Fehlversuchen: %T (%v), erwartet 429", loginMaxFailures, r.resp, r.err)
	}
}

func is429(r loginResult) bool {
	_, ok := r.resp.(api.Login429JSONResponse)
	return ok && r.err == nil
}
