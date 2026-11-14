package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestHashAndVerify(t *testing.T) {
	h, err := HashPassword("geheimes-passwort")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(h, "$argon2id$v=19$") || strings.Contains(h, "geheimes") {
		t.Fatalf("unerwarteter Hash %q", h)
	}
	if !VerifyPassword(h, "geheimes-passwort") {
		t.Error("richtiges Passwort abgelehnt")
	}
	for _, wrong := range []string{"", "geheimes-passwor", "Geheimes-passwort"} {
		if VerifyPassword(h, wrong) {
			t.Errorf("falsches Passwort %q akzeptiert", wrong)
		}
	}
	h2, _ := HashPassword("geheimes-passwort")
	if h == h2 {
		t.Error("gleicher Hash trotz zufälligem Salt")
	}
	for _, bad := range []string{"", "klartext", "$argon2id$v=19$m=1,t=1,p=1$$"} {
		if VerifyPassword(bad, "x") {
			t.Errorf("ungültiger Hash %q akzeptiert", bad)
		}
	}
}

func TestTokens(t *testing.T) {
	a, _ := NewToken()
	b, _ := NewToken()
	if a == b || len(a) < 40 {
		t.Fatalf("Tokens %q %q", a, b)
	}
	if HashToken(a) == a || len(HashToken(a)) != 64 {
		t.Error("HashToken")
	}
	if !EqualTokens(a, a) || EqualTokens(a, b) || EqualTokens("", "") {
		t.Error("EqualTokens")
	}
}

// testLimiter liefert einen Limiter mit steuerbarer Uhr.
func testLimiter(max int) (*Limiter, *time.Time) {
	now := time.Date(2026, 11, 6, 10, 0, 0, 0, time.UTC)
	l := NewLimiter(max, time.Minute)
	l.now = func() time.Time { return now }
	return l, &now
}

func mustReserve(t *testing.T, l *Limiter, key string) *Attempt {
	t.Helper()
	a, ok := l.Reserve(key)
	if !ok {
		t.Fatalf("%s: Versuch abgelehnt", key)
	}
	return a
}

func mustRefuse(t *testing.T, l *Limiter, key, why string) {
	t.Helper()
	if _, ok := l.Reserve(key); ok {
		t.Fatalf("%s: Versuch zugelassen, %s", key, why)
	}
}

func TestLimiterCountsFailuresPerKeyAndWindow(t *testing.T) {
	l, now := testLimiter(3)
	for range 3 {
		mustReserve(t, l, "1.2.3.4").Failed()
	}
	mustRefuse(t, l, "1.2.3.4", "obwohl 3 Fehlversuche gezählt sind")
	mustReserve(t, l, "5.6.7.8").Cancel()

	// Das Zeitfenster beginnt mit dem ersten Fehlversuch und endet nach einer Minute.
	*now = now.Add(time.Minute)
	mustReserve(t, l, "1.2.3.4").Failed()
	*now = now.Add(59 * time.Second)
	mustReserve(t, l, "1.2.3.4").Failed()
	mustReserve(t, l, "1.2.3.4").Failed()
	mustRefuse(t, l, "1.2.3.4", "obwohl das neue Zeitfenster 3 Fehlversuche enthält")
}

// Ticket #138: Laufende Versuche zählen bei der Zulassung mit.
func TestLimiterCountsPendingAttempts(t *testing.T) {
	l, _ := testLimiter(3)
	a := mustReserve(t, l, "1.2.3.4")
	mustReserve(t, l, "1.2.3.4")
	mustReserve(t, l, "1.2.3.4")
	mustRefuse(t, l, "1.2.3.4", "obwohl 3 Versuche laufen")
	mustReserve(t, l, "5.6.7.8")
	a.Cancel()
	mustReserve(t, l, "1.2.3.4")
	mustRefuse(t, l, "1.2.3.4", "obwohl wieder 3 Versuche laufen")
}

// Ticket #138: Erfolg, Fehlversuch und Abbruch geben die Reservierung frei. Nur der Fehlversuch zählt, nur der
// Erfolg setzt zurück, und ein Abbruch hebt keine Sperre auf.
func TestLimiterOutcomes(t *testing.T) {
	t.Run("Fehlversuch zählt einmal", func(t *testing.T) {
		l, _ := testLimiter(3)
		a := mustReserve(t, l, "ip")
		a.Failed()
		a.Failed() // wirkt nicht mehr
		a.Cancel() // wirkt nicht mehr, wie ein abschließendes defer
		mustReserve(t, l, "ip").Failed()
		mustReserve(t, l, "ip").Cancel()
		mustReserve(t, l, "ip").Failed()
		mustRefuse(t, l, "ip", "obwohl 3 Fehlversuche gezählt sind")
	})
	t.Run("Abbruch hebt keine Sperre auf", func(t *testing.T) {
		l, _ := testLimiter(3)
		mustReserve(t, l, "ip").Failed()
		mustReserve(t, l, "ip").Failed()
		for range 5 {
			mustReserve(t, l, "ip").Cancel()
		}
		mustReserve(t, l, "ip").Failed()
		mustRefuse(t, l, "ip", "obwohl 3 Fehlversuche gezählt sind")
	})
	t.Run("Erfolg setzt zurück und lässt andere Reservierungen bestehen", func(t *testing.T) {
		l, _ := testLimiter(3)
		mustReserve(t, l, "ip").Failed()
		ok := mustReserve(t, l, "ip")
		mustReserve(t, l, "ip") // läuft weiter
		mustRefuse(t, l, "ip", "obwohl 1 Fehlversuch und 2 laufende Versuche bestehen")
		ok.Succeeded()
		ok.Failed() // wirkt nicht mehr
		mustReserve(t, l, "ip")
		mustReserve(t, l, "ip")
		mustRefuse(t, l, "ip", "obwohl 3 Versuche laufen")
	})
	t.Run("Abgeschlossene Versuche ohne Fehlversuch hinterlassen keinen Eintrag", func(t *testing.T) {
		l, _ := testLimiter(3)
		mustReserve(t, l, "a").Cancel()
		mustReserve(t, l, "b").Succeeded()
		f := mustReserve(t, l, "c")
		f.Failed()
		if len(l.keys) != 1 || l.keys["c"] == nil {
			t.Fatalf("Einträge: %v, erwartet nur c", l.keys)
		}
	})
}

// Ticket #138: Gleichzeitige Reservierungen derselben IP-Adresse überschreiten die Grenze nicht. Mit -race
// prüft der Test zusätzlich den Datenzugriff.
func TestLimiterParallelReserve(t *testing.T) {
	const max, n = 10, 200
	l := NewLimiter(max, time.Minute)
	var (
		wg       sync.WaitGroup
		mu       sync.Mutex
		admitted []*Attempt
	)
	start := make(chan struct{})
	for range n {
		wg.Go(func() {
			<-start
			if a, ok := l.Reserve("1.2.3.4"); ok {
				mu.Lock()
				admitted = append(admitted, a)
				mu.Unlock()
			}
		})
	}
	close(start)
	wg.Wait()
	if len(admitted) != max {
		t.Fatalf("%d von %d gleichzeitigen Versuchen zugelassen, erwartet %d", len(admitted), n, max)
	}
	for _, a := range admitted {
		wg.Go(a.Failed)
	}
	wg.Wait()
	mustRefuse(t, l, "1.2.3.4", "obwohl 10 Fehlversuche gezählt sind")
}

func TestLimiterPrunesExpiredEntries(t *testing.T) {
	l, now := testLimiter(3)
	for i := range maxTrackedKeys {
		mustReserve(t, l, fmt.Sprintf("10.0.%d.%d", i/256, i%256)).Failed()
	}
	running := mustReserve(t, l, "laufend")
	*now = now.Add(time.Minute)
	mustReserve(t, l, "neu")
	if len(l.keys) != 2 {
		t.Fatalf("%d Einträge nach dem Aufräumen, erwartet 2 (laufend, neu)", len(l.keys))
	}
	running.Failed()
}

// Ticket #138: Throttle begrenzt laufende Prüfungen und Wartende und lehnt alle weiteren sofort ab.
func TestThrottleLimitsActiveAndWaiting(t *testing.T) {
	th := NewThrottle(2, 1, time.Minute)
	ctx := context.Background()
	for range 2 {
		if err := th.Acquire(ctx); err != nil {
			t.Fatalf("freier Platz: %v", err)
		}
	}
	waited := make(chan error)
	go func() { waited <- th.Acquire(ctx) }()
	waitFor(t, func() bool { return th.waiting.Load() == 1 })
	if err := th.Acquire(ctx); !errors.Is(err, ErrBusy) {
		t.Fatalf("volle Warteschlange: %v, erwartet ErrBusy", err)
	}
	th.Release()
	if err := <-waited; err != nil {
		t.Fatalf("Wartender: %v", err)
	}
	if th.waiting.Load() != 0 || len(th.slots) != 2 {
		t.Fatalf("wartend %d, belegt %d, erwartet 0 und 2", th.waiting.Load(), len(th.slots))
	}
	th.Release()
	th.Release()
	if len(th.slots) != 0 {
		t.Fatalf("%d Plätze nach Freigabe belegt", len(th.slots))
	}
}

func TestThrottleWaitEndsWithTimeoutOrCancel(t *testing.T) {
	th := NewThrottle(1, 1, 20*time.Millisecond)
	if err := th.Acquire(context.Background()); err != nil {
		t.Fatal(err)
	}
	if err := th.Acquire(context.Background()); !errors.Is(err, ErrBusy) {
		t.Fatalf("nach Ablauf der Wartezeit: %v, erwartet ErrBusy", err)
	}
	th = NewThrottle(1, 1, time.Minute)
	if err := th.Acquire(context.Background()); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error)
	go func() { done <- th.Acquire(ctx) }()
	waitFor(t, func() bool { return th.waiting.Load() == 1 })
	cancel()
	if err := <-done; !errors.Is(err, context.Canceled) {
		t.Fatalf("nach Abbruch: %v, erwartet context.Canceled", err)
	}
	if th.waiting.Load() != 0 || len(th.slots) != 1 {
		t.Fatalf("wartend %d, belegt %d, erwartet 0 und 1", th.waiting.Load(), len(th.slots))
	}
}

// Ticket #138: Auch bei vielen gleichzeitigen Anfragen laufen nie mehr Prüfungen als erlaubt.
func TestThrottleParallel(t *testing.T) {
	const active, n = 3, 100
	th := NewThrottle(active, n, time.Minute)
	var running, peak atomic.Int64
	var wg sync.WaitGroup
	for range n {
		wg.Go(func() {
			if err := th.Acquire(context.Background()); err != nil {
				t.Error(err)
				return
			}
			defer th.Release()
			r := running.Add(1)
			for p := peak.Load(); r > p && !peak.CompareAndSwap(p, r); p = peak.Load() {
			}
			time.Sleep(time.Millisecond)
			running.Add(-1)
		})
	}
	wg.Wait()
	if p := peak.Load(); p > active || p == 0 {
		t.Fatalf("höchstens %d gleichzeitige Prüfungen, erwartet 1 bis %d", p, active)
	}
}

func TestThrottleReleaseWithoutAcquirePanics(t *testing.T) {
	defer func() {
		if recover() == nil {
			t.Fatal("kein Panic")
		}
	}()
	NewThrottle(1, 0, time.Second).Release()
}

// waitFor wartet höchstens fünf Sekunden, bis cond erfüllt ist.
func waitFor(t *testing.T, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for !cond() {
		if time.Now().After(deadline) {
			t.Fatal("Bedingung nach 5 s nicht erfüllt")
		}
		time.Sleep(time.Millisecond)
	}
}

// BenchmarkVerifyPassword misst eine Argon2id-Passwortprüfung mit den Produktionsparametern. Die Dauer
// begründet die Grenzwerte für gleichzeitige Prüfungen (Ticket #138, docs/login-begrenzung.md).
func BenchmarkVerifyPassword(b *testing.B) {
	h, err := HashPassword("geheimes-passwort")
	if err != nil {
		b.Fatal(err)
	}
	b.ReportAllocs()
	for b.Loop() {
		VerifyPassword(h, "falsches-passwort")
	}
}
