// Package auth enthält Passwort-Hashing, Sitzungs-Tokens und die Begrenzung von Anmeldeversuchen und
// gleichzeitigen Passwortprüfungen (ARCHITECTURE.md, Abschnitt 4, Sicherheit; Ticket #138).
package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"golang.org/x/crypto/argon2"
)

// Parameter für Argon2id nach der Empfehlung der OWASP (19 MiB, 2 Durchläufe, 1 Thread) mit etwas mehr Speicher.
const (
	argonTime    uint32 = 2
	argonMemory  uint32 = 64 * 1024
	argonThreads uint8  = 1
	argonKeyLen  uint32 = 32
	saltLen             = 16
)

// CookieName ist der Name des Sitzungscookies der Redaktion.
const CookieName = "ki_session"

// MinPasswordLength ist die Mindestlänge für Passwörter.
const MinPasswordLength = 10

var b64 = base64.RawStdEncoding

// HashPassword erzeugt einen Argon2id-Hash im üblichen PHC-Format
// ($argon2id$v=19$m=…,t=…,p=…$salt$hash).
func HashPassword(password string) (string, error) {
	salt := make([]byte, saltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	key := argon2.IDKey([]byte(password), salt, argonTime, argonMemory, argonThreads, argonKeyLen)
	return fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version, argonMemory, argonTime, argonThreads, b64.EncodeToString(salt), b64.EncodeToString(key)), nil
}

var errBadHash = errors.New("ungültiger passwort-hash")

// VerifyPassword vergleicht ein Passwort in konstanter Zeit mit einem Hash aus HashPassword.
func VerifyPassword(encoded, password string) bool {
	ok, err := verify(encoded, password)
	return err == nil && ok
}

func verify(encoded, password string) (bool, error) {
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 || parts[1] != "argon2id" {
		return false, errBadHash
	}
	var version int
	if _, err := fmt.Sscanf(parts[2], "v=%d", &version); err != nil || version != argon2.Version {
		return false, errBadHash
	}
	var (
		memory, iterations uint32
		threads            uint8
	)
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &memory, &iterations, &threads); err != nil {
		return false, errBadHash
	}
	salt, err := b64.DecodeString(parts[4])
	if err != nil {
		return false, errBadHash
	}
	want, err := b64.DecodeString(parts[5])
	if err != nil || len(want) == 0 {
		return false, errBadHash
	}
	got := argon2.IDKey([]byte(password), salt, iterations, memory, threads, uint32(len(want)))
	return subtle.ConstantTimeCompare(got, want) == 1, nil
}

// dummyHash wird geprüft, wenn es zu einer E-Mail-Adresse kein Konto gibt. So dauert die Antwort
// gleich lang, und die Antwortzeit verrät nicht, ob ein Konto existiert.
var dummyHash, _ = HashPassword("kein-konto-vorhanden")

// SpendTime prüft ein Passwort gegen einen Platzhalter-Hash.
func SpendTime(password string) { _ = VerifyPassword(dummyHash, password) }

// NewToken erzeugt einen zufälligen Wert mit 256 Bit für Sitzungs-Cookies und CSRF-Tokens.
func NewToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// HashToken liefert den SHA-256-Hash eines Tokens. Die Datenbank speichert nur diesen Hash.
func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// EqualTokens vergleicht zwei Tokens in konstanter Zeit.
func EqualTokens(a, b string) bool {
	return a != "" && subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

// Limiter begrenzt Anmeldeversuche je Schlüssel (IP-Adresse) auf max Fehlversuche je Zeitfenster. Das
// Zeitfenster beginnt mit dem ersten gezählten Fehlversuch.
//
// Zulassung und Ergebnis sind getrennt (Ticket #138): Reserve lässt einen Versuch nur zu, solange
// Fehlversuche und laufende Versuche zusammen unter max liegen, und reserviert ihn in derselben Sperre.
// Laufende Versuche zählen also mit, als wären sie bereits gescheitert. Parallele Anfragen können die Grenze
// deshalb nicht überholen, während ihre Passwortprüfung noch läuft.
//
// Die Zähler liegen nur im Arbeitsspeicher (ARCHITECTURE.md, Abschnitt 11).
type Limiter struct {
	mu     sync.Mutex
	max    int
	window time.Duration
	now    func() time.Time
	keys   map[string]*attempts
}

// attempts sind die Versuche eines Schlüssels.
type attempts struct {
	start    time.Time // Beginn des Zeitfensters, gültig solange failures > 0
	failures int       // gezählte Fehlversuche im Zeitfenster
	pending  int       // zugelassene Versuche, deren Ergebnis noch aussteht
}

// expire setzt die Fehlversuche zurück, wenn ihr Zeitfenster abgelaufen ist.
func (a *attempts) expire(now time.Time, window time.Duration) {
	if a.failures > 0 && now.Sub(a.start) >= window {
		a.failures = 0
	}
}

// maxTrackedKeys löst das Aufräumen abgelaufener Einträge aus. Neue Einträge mit Fehlversuchen entstehen nur
// nach einer Passwortprüfung, deren Zahl Throttle begrenzt; die Tabelle wächst daher nur langsam.
const maxTrackedKeys = 10_000

// NewLimiter erlaubt max Fehlversuche je Zeitfenster.
func NewLimiter(max int, w time.Duration) *Limiter {
	return &Limiter{max: max, window: w, now: time.Now, keys: map[string]*attempts{}}
}

// Reserve lässt einen Anmeldeversuch für key zu und reserviert ihn, wenn Fehlversuche und laufende Versuche
// zusammen unter max liegen. Andernfalls ist ok false und es wurde nichts reserviert.
//
// Der Aufrufer meldet das Ergebnis eines zugelassenen Versuchs mit Attempt.Failed, Attempt.Succeeded oder
// Attempt.Cancel. Nur der erste dieser Aufrufe wirkt; ein abschließendes „defer attempt.Cancel()“ gibt die
// Reservierung deshalb in jedem Fall frei, auch nach einem Panic.
func (l *Limiter) Reserve(key string) (attempt *Attempt, ok bool) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	a := l.keys[key]
	if a == nil {
		if len(l.keys) >= maxTrackedKeys {
			l.prune(now)
		}
		a = &attempts{}
		l.keys[key] = a
	}
	a.expire(now, l.window)
	if a.failures+a.pending >= l.max {
		return nil, false
	}
	a.pending++
	return &Attempt{l: l, key: key}, true
}

// prune entfernt Einträge ohne laufende Versuche, deren Fehlversuche abgelaufen sind. Aufruf nur unter l.mu.
func (l *Limiter) prune(now time.Time) {
	for k, a := range l.keys {
		a.expire(now, l.window)
		if a.failures == 0 && a.pending == 0 {
			delete(l.keys, k)
		}
	}
}

// Attempt ist ein zugelassener Anmeldeversuch, dessen Ergebnis noch aussteht.
type Attempt struct {
	l    *Limiter
	key  string
	done bool // geschützt durch l.mu
}

// Failed zählt den Versuch als Fehlversuch: Die Passwortprüfung hat falsche Zugangsdaten ergeben.
func (a *Attempt) Failed() {
	a.finish(func(s *attempts, now time.Time) {
		if s.failures == 0 {
			s.start = now
		}
		s.failures++
	})
}

// Succeeded setzt die Fehlversuche nach einer erfolgreichen Anmeldung zurück. Andere laufende Versuche
// desselben Schlüssels bleiben reserviert und melden ihr Ergebnis selbst.
func (a *Attempt) Succeeded() {
	a.finish(func(s *attempts, _ time.Time) { s.failures = 0 })
}

// Cancel gibt die Reservierung frei, ohne etwas zu zählen. Das gilt, wenn die Passwortprüfung kein Ergebnis
// geliefert hat: ungültige Anfrage, Überlast, Abbruch durch den Client vor der Prüfung oder ein interner
// Fehler. Bereits gezählte Fehlversuche bleiben erhalten; Cancel hebt die Sperre also nicht auf.
func (a *Attempt) Cancel() {
	a.finish(func(*attempts, time.Time) {})
}

// finish beendet die Reservierung einmalig und wendet das Ergebnis an.
func (a *Attempt) finish(apply func(s *attempts, now time.Time)) {
	l := a.l
	l.mu.Lock()
	defer l.mu.Unlock()
	if a.done {
		return
	}
	a.done = true
	// Der Eintrag existiert noch: Einträge mit laufenden Versuchen werden nie entfernt.
	s := l.keys[a.key]
	s.pending--
	now := l.now()
	s.expire(now, l.window)
	apply(s, now)
	if s.failures == 0 && s.pending == 0 {
		delete(l.keys, a.key)
	}
}

// ErrBusy meldet, dass Throttle keinen Platz für eine Passwortprüfung vergeben kann: Alle Plätze sind belegt
// und die Warteschlange ist voll, oder die Wartezeit ist abgelaufen.
var ErrBusy = errors.New("zu viele gleichzeitige passwortprüfungen")

// Throttle begrenzt gleichzeitig laufende Passwortprüfungen über alle IP-Adressen (Ticket #138). Jede
// Argon2id-Prüfung belegt argonMemory (64 MiB) und einen Prozessorkern, auch für unbekannte Konten
// (SpendTime). Das Limit je IP-Adresse schützt davor nicht, wenn Anfragen von vielen Adressen kommen.
//
// Höchstens active Prüfungen laufen gleichzeitig. Höchstens waiting weitere Anfragen warten je höchstens
// maxWait auf einen freien Platz. Alle übrigen lehnt Acquire sofort mit ErrBusy ab, bevor Argon2 Speicher
// belegt. Wartende erhalten frei werdende Plätze vor neu eintreffenden Anfragen.
type Throttle struct {
	slots      chan struct{} // ein Eintrag je laufender Prüfung
	waiting    atomic.Int64  // Anfragen, die gerade auf einen Platz warten
	maxWaiting int64
	maxWait    time.Duration
}

// NewThrottle erlaubt active gleichzeitige Prüfungen und waiting Wartende mit höchstens maxWait Wartezeit.
func NewThrottle(active, waiting int, maxWait time.Duration) *Throttle {
	return &Throttle{slots: make(chan struct{}, active), maxWaiting: int64(waiting), maxWait: maxWait}
}

// Acquire belegt einen Platz für eine Passwortprüfung. Nach Erfolg muss der Aufrufer Release aufrufen.
// Liefert ErrBusy bei Überlast oder ctx.Err(), wenn der Client während des Wartens abbricht.
func (t *Throttle) Acquire(ctx context.Context) error {
	select {
	case t.slots <- struct{}{}:
		return nil
	default:
	}
	if t.waiting.Add(1) > t.maxWaiting {
		t.waiting.Add(-1)
		return ErrBusy
	}
	defer t.waiting.Add(-1)
	timer := time.NewTimer(t.maxWait)
	defer timer.Stop()
	select {
	case t.slots <- struct{}{}:
		return nil
	case <-timer.C:
		return ErrBusy
	case <-ctx.Done():
		return ctx.Err()
	}
}

// Release gibt einen mit Acquire belegten Platz frei.
func (t *Throttle) Release() {
	select {
	case <-t.slots:
	default:
		panic("auth: Throttle.Release ohne Acquire")
	}
}
