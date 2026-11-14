package httpserver

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"path/filepath"
	"testing"
	"time"

	"ki-web/backend/internal/api"
	"ki-web/backend/internal/auth"
	"ki-web/backend/internal/service"
	"ki-web/backend/internal/store"
)

// Ticket #138: Diese Tests rufen den Login-Handler direkt auf und halten die Passwortprüfung mit einer
// Testbarriere an. So lässt sich deterministisch zählen, wie viele parallele Anfragen die teure
// Argon2-Prüfung erreichen, bevor die erste ein Ergebnis hat. Hinter der Barriere laufen echte Datenbank,
// echtes Konto und echte Argon2-Prüfung (accounts.Login).

const (
	loginTestEmail    = "redakteurin@example.test"
	loginTestPassword = "sicheres-passwort-1"
	loginTestWrong    = "falsches-passwort"
	loginTestUnknown  = "niemand@example.test"
	testIP            = "203.0.113.7"
	otherIP           = "198.51.100.23"
)

// newLoginTestServer baut die API-Handler mit den Grenzwerten des Betriebs.
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

// withoutGlobalLimit hebt die globale Grenze auf, damit ein Test nur die Grenze je IP-Adresse prüft.
func withoutGlobalLimit(s *apiServer) { s.passwordChecks = auth.NewThrottle(1000, 0, 0) }

// loginBarrier hält jede Passwortprüfung an, bis der Test sie freigibt.
type loginBarrier struct {
	arrived chan struct{} // ein Eintrag je Anfrage, die die Passwortprüfung erreicht hat
	release chan struct{} // close gibt alle angehaltenen und folgenden Prüfungen frei
}

// holdPasswordChecks setzt die Barriere vor die aktuelle Passwortprüfung s.login.
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
	ip   string
	resp api.LoginResponseObject
	err  error
}

// status liefert den HTTP-Status, den der Handler für das Ergebnis schreiben würde.
func (r loginResult) status() int {
	if r.err != nil {
		return 500
	}
	switch resp := r.resp.(type) {
	case api.Login200JSONResponse:
		return 200
	case api.Login400JSONResponse:
		return 400
	case api.Login401JSONResponse:
		return 401
	case api.Login429JSONResponse:
		return 429
	case api.Login503JSONResponse:
		if resp.Headers.RetryAfter != loginRetryAfter {
			return -503 // 503 ohne dokumentiertes Retry-After
		}
		return 503
	}
	return 0
}

// tryLogin ruft den Login-Handler so auf, als käme die Anfrage von ip.
func tryLogin(ctx context.Context, s *apiServer, ip, email, password string) loginResult {
	ctx = context.WithValue(ctx, clientIPKey, ip)
	resp, err := s.Login(ctx, api.LoginRequestObject{Body: &api.LoginJSONRequestBody{Email: email, Password: password}})
	return loginResult{ip, resp, err}
}

// startLogins startet n Anmeldeversuche gleichzeitig. Die Ergebnisse kommen über den Kanal.
func startLogins(s *apiServer, n int, ip func(i int) string, email, password string) <-chan loginResult {
	results := make(chan loginResult, n)
	for i := range n {
		go func() { results <- tryLogin(context.Background(), s, ip(i), email, password) }()
	}
	return results
}

// sameIP lässt alle Versuche von derselben IP-Adresse kommen.
func sameIP(int) string { return testIP }

// distinctIPs lässt jeden Versuch von einer eigenen IP-Adresse kommen.
func distinctIPs(i int) string { return fmt.Sprintf("10.0.%d.%d", i/256, i%256) }

// waitFor wartet, bis admitted Versuche die (angehaltene) Passwortprüfung erreicht und answered Versuche
// bereits eine Antwort erhalten haben. Angehaltene Versuche antworten erst nach der Freigabe.
func waitFor(t *testing.T, b *loginBarrier, results <-chan loginResult, total int) (admitted int, answered []loginResult) {
	t.Helper()
	timeout := time.After(10 * time.Second)
	for admitted+len(answered) < total {
		select {
		case <-b.arrived:
			admitted++
		case r := <-results:
			answered = append(answered, r)
		case <-timeout:
			t.Fatalf("nach 10 s: %d Versuche in der Passwortprüfung, %d beantwortet, erwartet zusammen %d", admitted, len(answered), total)
		}
	}
	return admitted, answered
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

func wantAll(t *testing.T, what string, results []loginResult, status int) {
	t.Helper()
	for _, r := range results {
		if got := r.status(); got != status {
			t.Errorf("%s: Status %d (%T, %v), erwartet %d", what, got, r.resp, r.err, status)
		}
	}
}

func want(t *testing.T, what string, r loginResult, status int) {
	t.Helper()
	wantAll(t, what, []loginResult{r}, status)
}

// wantRemaining prüft, dass ip noch genau n Versuche frei hat: n Fehlversuche, danach 429. Laufende
// Reservierungen und gezählte Fehlversuche verringern n. Ersetzt dazu die Passwortprüfung durch eine sofortige
// Ablehnung; der Test darf s danach nicht weiter nutzen.
func wantRemaining(t *testing.T, s *apiServer, ip string, n int) {
	t.Helper()
	s.login = func(context.Context, string, string) (service.Session, error) {
		return service.Session{}, service.ErrInvalidCredentials
	}
	for i := range n {
		if r := tryLogin(context.Background(), s, ip, loginTestEmail, loginTestWrong); r.status() != 401 {
			t.Fatalf("%s: Versuch %d von %d freien: Status %d, erwartet 401", ip, i+1, n, r.status())
		}
	}
	if r := tryLogin(context.Background(), s, ip, loginTestEmail, loginTestWrong); r.status() != 429 {
		t.Fatalf("%s: nach %d freien Versuchen Status %d, erwartet 429", ip, n, r.status())
	}
}

// Ticket #138: Parallele Versuche derselben IP dürfen zusammen nicht mehr Passwortprüfungen erreichen, als
// Fehlversuche erlaubt sind, für falsche Passwörter wie für unbekannte Konten. Vor der Korrektur passierten
// alle elf die Zulassung, weil ein Fehlversuch erst nach der Argon2-Prüfung gezählt wurde.
func TestParallelLoginsFromOneIPAreLimitedBeforePasswordCheck(t *testing.T) {
	for _, tc := range []struct{ name, email string }{
		{"falsches Passwort", loginTestEmail},
		{"unbekanntes Konto", loginTestUnknown},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s := newLoginTestServer(t)
			withoutGlobalLimit(s)
			b := holdPasswordChecks(s)
			const n = loginMaxFailures + 1
			results := startLogins(s, n, sameIP, tc.email, loginTestWrong)

			admitted, answered := waitFor(t, b, results, n)
			if admitted != loginMaxFailures {
				t.Fatalf("%d parallele Passwortprüfungen zugelassen, erwartet höchstens %d", admitted, loginMaxFailures)
			}
			wantAll(t, "überzähliger Versuch", answered, 429)

			close(b.release)
			wantAll(t, "zugelassener Versuch", collect(t, results, admitted), 401)
			// Die zehn Fehlversuche sind gezählt: Auch das richtige Passwort wird jetzt vor der Prüfung abgewiesen.
			want(t, "richtiges Passwort nach 10 Fehlversuchen", tryLogin(context.Background(), s, testIP, loginTestEmail, loginTestPassword), 429)
		})
	}
}

// Ticket #138: Laufende Versuche einer IP-Adresse sperren keine andere IP-Adresse.
func TestParallelLoginsFromOtherIPsAreAdmitted(t *testing.T) {
	s := newLoginTestServer(t)
	withoutGlobalLimit(s)
	b := holdPasswordChecks(s)
	locked := startLogins(s, loginMaxFailures, sameIP, loginTestEmail, loginTestWrong)
	waitFor(t, b, locked, loginMaxFailures)
	want(t, "11. Versuch derselben IP", tryLogin(context.Background(), s, testIP, loginTestEmail, loginTestPassword), 429)

	other := startLogins(s, 1, func(int) string { return otherIP }, loginTestEmail, loginTestPassword)
	if admitted, _ := waitFor(t, b, other, 1); admitted != 1 {
		t.Fatal("Versuch einer anderen IP-Adresse nicht zur Passwortprüfung zugelassen")
	}
	close(b.release)
	wantAll(t, "gesperrte IP", collect(t, locked, loginMaxFailures), 401)
	want(t, "andere IP mit richtigem Passwort", collect(t, other, 1)[0], 200)
	want(t, "gesperrte IP danach", tryLogin(context.Background(), s, testIP, loginTestEmail, loginTestPassword), 429)
	wantRemaining(t, s, otherIP, loginMaxFailures)
}

// Ticket #138: Jede Reservierung wird freigegeben. Falsche Zugangsdaten zählen als Fehlversuch, Erfolg setzt
// zurück, alles ohne Ergebnis der Passwortprüfung zählt nicht und hebt keine Sperre auf.
func TestLoginOutcomesReleaseReservations(t *testing.T) {
	ctx := context.Background()

	t.Run("Fehlversuche mit unbekanntem Konto und falschem Passwort zählen", func(t *testing.T) {
		s := newLoginTestServer(t)
		want(t, "unbekanntes Konto", tryLogin(ctx, s, testIP, loginTestUnknown, loginTestPassword), 401)
		want(t, "falsches Passwort", tryLogin(ctx, s, testIP, loginTestEmail, loginTestWrong), 401)
		wantRemaining(t, s, testIP, loginMaxFailures-2)
	})

	t.Run("Erfolg setzt Fehlversuche zurück", func(t *testing.T) {
		s := newLoginTestServer(t)
		for range loginMaxFailures - 1 {
			want(t, "falsches Passwort", tryLogin(ctx, s, testIP, loginTestEmail, loginTestWrong), 401)
		}
		want(t, "richtiges Passwort", tryLogin(ctx, s, testIP, loginTestEmail, loginTestPassword), 200)
		wantRemaining(t, s, testIP, loginMaxFailures)
	})

	t.Run("Ungültige Anfrage zählt nicht", func(t *testing.T) {
		s := newLoginTestServer(t)
		for range loginMaxFailures + 1 {
			want(t, "ohne Passwort", tryLogin(ctx, s, testIP, loginTestEmail, ""), 400)
		}
		wantRemaining(t, s, testIP, loginMaxFailures)
	})

	t.Run("Interner Fehler zählt nicht und hebt keine Sperre auf", func(t *testing.T) {
		s := newLoginTestServer(t)
		for range loginMaxFailures - 1 {
			want(t, "falsches Passwort", tryLogin(ctx, s, testIP, loginTestEmail, loginTestWrong), 401)
		}
		s.login = func(context.Context, string, string) (service.Session, error) {
			return service.Session{}, errors.New("datenbank nicht erreichbar")
		}
		for range loginMaxFailures + 1 {
			want(t, "Datenbankfehler", tryLogin(ctx, s, testIP, loginTestEmail, loginTestWrong), 500)
		}
		wantRemaining(t, s, testIP, 1)
	})

	t.Run("Abbruch vor der Passwortprüfung zählt nicht", func(t *testing.T) {
		s := newLoginTestServer(t)
		s.passwordChecks = auth.NewThrottle(1, 1, time.Minute)
		b := holdPasswordChecks(s)
		busy := startLogins(s, 1, func(int) string { return otherIP }, loginTestEmail, loginTestWrong)
		waitFor(t, b, busy, 1)

		// Der Versuch wartet auf einen freien Platz, bis der Client abbricht.
		abortCtx, abort := context.WithCancel(ctx)
		aborted := make(chan loginResult, 1)
		go func() { aborted <- tryLogin(abortCtx, s, testIP, loginTestEmail, loginTestWrong) }()
		select {
		case r := <-aborted:
			t.Fatalf("Versuch wartet nicht auf einen Platz: Status %d", r.status())
		case <-time.After(50 * time.Millisecond):
		}
		abort()
		want(t, "abgebrochener Versuch", <-aborted, 503)

		close(b.release)
		want(t, "laufender Versuch", collect(t, busy, 1)[0], 401)
		if len(b.arrived) != 0 {
			t.Fatal("abgebrochener Versuch hat die Passwortprüfung erreicht")
		}
		wantRemaining(t, s, testIP, loginMaxFailures)
	})

	t.Run("Abbruch während der Passwortprüfung zählt deren Ergebnis", func(t *testing.T) {
		s := newLoginTestServer(t)
		// Argon2 lässt sich nicht unterbrechen: Die Prüfung läuft nach dem Abbruch zu Ende.
		s.login = func(context.Context, string, string) (service.Session, error) {
			return service.Session{}, service.ErrInvalidCredentials
		}
		b := holdPasswordChecks(s)
		abortCtx, abort := context.WithCancel(ctx)
		aborted := make(chan loginResult, 1)
		go func() { aborted <- tryLogin(abortCtx, s, testIP, loginTestEmail, loginTestWrong) }()
		<-b.arrived
		abort()
		close(b.release)
		want(t, "abgebrochener Versuch", <-aborted, 401)
		wantRemaining(t, s, testIP, loginMaxFailures-1)
	})
}

// Ticket #138: Über alle IP-Adressen laufen höchstens passwordChecksActive Prüfungen gleichzeitig, höchstens
// passwordChecksWaiting Anfragen warten. Alle weiteren erhalten vor der Passwortprüfung 503 mit Retry-After,
// ohne dass ein Fehlversuch zählt. Geprüft mit der doppelten Zahl gleichzeitig zugelassener Anfragen.
func TestPasswordChecksAreLimitedAcrossIPs(t *testing.T) {
	s := newLoginTestServer(t)
	// Grenzwerte des Betriebs, nur mit langer Wartezeit, damit langsame Testumgebungen das Ergebnis nicht ändern.
	s.passwordChecks = auth.NewThrottle(passwordChecksActive, passwordChecksWaiting, time.Minute)
	b := holdPasswordChecks(s)
	const capacity = passwordChecksActive + passwordChecksWaiting
	const n = 2 * capacity
	results := startLogins(s, n, distinctIPs, loginTestEmail, loginTestWrong)

	// Erwartet: passwordChecksActive Prüfungen laufen, passwordChecksWaiting warten ohne Antwort, der Rest
	// ist sofort mit 503 beantwortet.
	admitted, answered := waitFor(t, b, results, n-passwordChecksWaiting)
	if admitted != passwordChecksActive {
		t.Fatalf("%d gleichzeitige Passwortprüfungen, erwartet %d", admitted, passwordChecksActive)
	}
	wantAll(t, "überzählige Anfrage", answered, 503)
	select {
	case r := <-results:
		t.Fatalf("wartende Anfrage vorzeitig beantwortet: Status %d", r.status())
	case <-time.After(50 * time.Millisecond):
	}

	close(b.release)
	wantAll(t, "laufende und wartende Anfragen", collect(t, results, capacity), 401)
	if got := admitted + len(b.arrived); got != capacity {
		t.Errorf("%d Anfragen haben die Passwortprüfung erreicht, erwartet %d", got, capacity)
	}
	// Alle Plätze sind wieder frei (neue IP-Adressen), und die abgewiesenen Anfragen haben keinen Fehlversuch
	// hinterlassen.
	results = startLogins(s, capacity, func(i int) string { return distinctIPs(n + i) }, loginTestEmail, loginTestWrong)
	wantAll(t, "nächste Anfragen", collect(t, results, capacity), 401)
	wantRemaining(t, s, answered[0].ip, loginMaxFailures)
}
