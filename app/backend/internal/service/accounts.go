package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/mail"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"ki-web/backend/internal/auth"
	"ki-web/backend/internal/media"
	"ki-web/backend/internal/store"
)

// SessionTTL ist die Gültigkeit einer Sitzung ab der Anmeldung.
const SessionTTL = 12 * time.Hour

// MaxDisplayNameLength ist die größte Länge eines Anzeigenamens in Zeichen (Ticket #64).
const MaxDisplayNameLength = 80

var (
	// ErrInvalidCredentials gilt für unbekannte E-Mail-Adressen, falsche Passwörter und deaktivierte
	// Konten gleichermaßen, damit die Antwort nicht verrät, welche Konten es gibt.
	ErrInvalidCredentials = errors.New("anmeldedaten ungültig")
	// ErrUnauthenticated bedeutet: keine, abgelaufene oder entzogene Sitzung.
	ErrUnauthenticated = errors.New("nicht angemeldet")
	// ErrEmailTaken bedeutet: Es gibt bereits ein Konto mit dieser E-Mail-Adresse.
	ErrEmailTaken = errors.New("e-mail-adresse bereits vergeben")
	// ErrSelf bedeutet: Das eigene Konto lässt sich nicht deaktivieren.
	ErrSelf = errors.New("eigenes konto")
	// ErrAdminFixed bedeutet: Einem Admin-Konto lässt sich die Admin-Rolle nicht entziehen (REQ-64-AC3).
	ErrAdminFixed = errors.New("admin-rolle nicht entziehbar")
	// ErrWrongPassword bedeutet: Das angegebene aktuelle Passwort stimmt nicht (REQ-64-AC7).
	ErrWrongPassword = errors.New("aktuelles passwort falsch")
)

// ValidationError beschreibt eine ungültige Eingabe in verständlichen Worten.
type ValidationError struct{ Msg string }

func (e *ValidationError) Error() string { return e.Msg }

func invalid(format string, args ...any) error {
	return &ValidationError{Msg: fmt.Sprintf(format, args...)}
}

// User ist ein Redaktionskonto ohne Passwort-Hash.
type User struct {
	ID          int64
	Email       string
	DisplayName string
	Roles       Roles
	Active      bool
	CreatedAt   time.Time
}

// Identity ist die angemeldete Person einer gültigen Sitzung.
type Identity struct {
	UserID      int64
	Email       string
	DisplayName string
	Roles       Roles
	CSRFToken   string
	SessionID   string // Hash des Cookie-Werts
}

// Session ist eine neu angelegte Sitzung. Token ist der Wert für das Cookie.
type Session struct {
	Token     string
	ExpiresAt time.Time
	Identity  Identity
}

// Avatar ist ein gespeichertes Profilbild.
type Avatar struct {
	Key, MimeType string
	Width, Height int
}

// Profile ist das eigene Profil eines Kontos (Ticket #64).
type Profile struct {
	UserID      int64
	Email       string
	DisplayName string
	Roles       Roles
	Avatar      *Avatar
}

// AuthorOption ist ein als Autor wählbares Konto.
type AuthorOption struct {
	ID          int64
	Email       string
	DisplayName string
}

// Accounts verwaltet Konten, Rollen, Profile und Sitzungen der Redaktion.
type Accounts struct {
	db  *sql.DB
	q   *store.Queries
	now func() time.Time
}

func NewAccounts(db *sql.DB) *Accounts {
	return &Accounts{db: db, q: store.New(db), now: time.Now}
}

func formatTime(t time.Time) string { return t.UTC().Format(time.RFC3339) }

// NormalizeEmail entfernt Leerzeichen und schreibt die Adresse klein.
func NormalizeEmail(s string) string { return strings.ToLower(strings.TrimSpace(s)) }

// MaxEmailLength ist die größte zulässige Länge einer E-Mail-Adresse (RFC 5321, Pfad ohne spitze Klammern).
const MaxEmailLength = 254

// validateEmail prüft eine bereits normalisierte Adresse. Das Frontend der Beratungsanfrage (Ticket #136)
// prüft vorab gröber; diese Prüfung ist maßgeblich.
func validateEmail(email string) error {
	if email == "" {
		return invalid("Bitte eine E-Mail-Adresse angeben.")
	}
	if len(email) > MaxEmailLength {
		return invalid("Die E-Mail-Adresse ist zu lang.")
	}
	addr, err := mail.ParseAddress(email)
	if err != nil || addr.Address != email || !strings.Contains(email[strings.LastIndex(email, "@")+1:], ".") {
		return invalid("Bitte eine gültige E-Mail-Adresse angeben.")
	}
	return nil
}

func validatePassword(pw string) error {
	if len([]rune(pw)) < auth.MinPasswordLength {
		return invalid("Das Passwort muss mindestens %d Zeichen lang sein.", auth.MinPasswordLength)
	}
	if len(pw) > 1024 {
		return invalid("Das Passwort ist zu lang.")
	}
	return nil
}

// cleanDisplayName trimmt den Anzeigenamen und prüft Länge und Zeichen.
func cleanDisplayName(name string) (string, error) {
	name = strings.TrimSpace(name)
	if utf8.RuneCountInString(name) > MaxDisplayNameLength {
		return "", invalid("Der Name darf höchstens %d Zeichen lang sein.", MaxDisplayNameLength)
	}
	if strings.ContainsFunc(name, unicode.IsControl) {
		return "", invalid("Der Name enthält unzulässige Steuerzeichen.")
	}
	return name, nil
}

// checkRoles prüft eine Rollenmenge, die nicht über ParseRoles entstanden sein muss.
func checkRoles(roles Roles) (Roles, error) {
	return ParseRoles(roles.Strings())
}

// ---------------------------------------------------------------------------
// Rollen laden und schreiben
// ---------------------------------------------------------------------------

// rolesFor liefert die Rollen mehrerer Konten. Konten ohne Eintrag in user_roles (angelegt von einer Version
// vor #64, etwa nach einem Rollback) behalten ihre Rolle aus der alten Spalte users.role.
func rolesFor(ctx context.Context, q *store.Queries, legacy map[int64]string) (map[int64]Roles, error) {
	ids := make([]int64, 0, len(legacy))
	for id := range legacy {
		ids = append(ids, id)
	}
	out := make(map[int64]Roles, len(legacy))
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := q.ListUserRoles(ctx, ids)
	if err != nil {
		return nil, err
	}
	for _, r := range rows {
		out[r.UserID] = append(out[r.UserID], Role(r.Role))
	}
	for id, old := range legacy {
		if len(out[id]) == 0 {
			if r, ok := ParseRole(old); ok {
				out[id] = Roles{r}
			}
		}
		out[id] = out[id].normalize()
	}
	return out, nil
}

func rolesOf(ctx context.Context, q *store.Queries, userID int64, legacy string) (Roles, error) {
	m, err := rolesFor(ctx, q, map[int64]string{userID: legacy})
	if err != nil {
		return nil, err
	}
	return m[userID], nil
}

// writeRoles ersetzt die Rollen eines Kontos und pflegt die alte Spalte users.role mit.
func writeRoles(ctx context.Context, q *store.Queries, userID int64, roles Roles) error {
	if err := q.DeleteUserRoles(ctx, userID); err != nil {
		return err
	}
	for _, r := range roles {
		if err := q.InsertUserRole(ctx, store.InsertUserRoleParams{UserID: userID, Role: string(r)}); err != nil {
			return err
		}
	}
	return q.SetUserLegacyRole(ctx, store.SetUserLegacyRoleParams{Role: string(roles.Legacy()), ID: userID})
}

func loadUser(ctx context.Context, q *store.Queries, id int64) (User, error) {
	row, err := q.GetUserByID(ctx, id)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, ErrNotFound
	}
	if err != nil {
		return User{}, err
	}
	roles, err := rolesOf(ctx, q, row.ID, row.Role)
	if err != nil {
		return User{}, err
	}
	return toUser(row, roles), nil
}

func toUser(r store.User, roles Roles) User {
	return User{ID: r.ID, Email: r.Email, DisplayName: r.DisplayName, Roles: roles, Active: r.Active, CreatedAt: parseTime(r.CreatedAt)}
}

// ---------------------------------------------------------------------------
// Konten verwalten (Anforderung 11, Ticket #64)
// ---------------------------------------------------------------------------

// CreateUser legt ein aktives Konto mit mindestens einer Rolle an. Die E-Mail-Adresse ist der Benutzername.
func (a *Accounts) CreateUser(ctx context.Context, email, password string, roles Roles) (User, error) {
	email = NormalizeEmail(email)
	if err := validateEmail(email); err != nil {
		return User{}, err
	}
	roles, err := checkRoles(roles)
	if err != nil {
		return User{}, err
	}
	if err := validatePassword(password); err != nil {
		return User{}, err
	}
	if _, err := a.q.GetUserByEmail(ctx, email); err == nil {
		return User{}, ErrEmailTaken
	} else if !errors.Is(err, sql.ErrNoRows) {
		return User{}, err
	}
	hash, err := auth.HashPassword(password)
	if err != nil {
		return User{}, err
	}
	tx, err := a.db.BeginTx(ctx, nil)
	if err != nil {
		return User{}, err
	}
	defer tx.Rollback()
	q := a.q.WithTx(tx)
	id, err := q.CreateUser(ctx, store.CreateUserParams{
		Email: email, PasswordHash: hash, Role: string(roles.Legacy()), CreatedAt: formatTime(a.now()),
	})
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			return User{}, ErrEmailTaken
		}
		return User{}, err
	}
	if err := writeRoles(ctx, q, id, roles); err != nil {
		return User{}, err
	}
	u, err := loadUser(ctx, q, id)
	if err != nil {
		return User{}, err
	}
	return u, tx.Commit()
}

// Users liefert alle Konten mit Rollen, sortiert nach E-Mail-Adresse.
func (a *Accounts) Users(ctx context.Context) ([]User, error) {
	rows, err := a.q.ListUsers(ctx)
	if err != nil {
		return nil, err
	}
	legacy := make(map[int64]string, len(rows))
	for _, r := range rows {
		legacy[r.ID] = r.Role
	}
	roles, err := rolesFor(ctx, a.q, legacy)
	if err != nil {
		return nil, err
	}
	out := make([]User, 0, len(rows))
	for _, r := range rows {
		out = append(out, toUser(r, roles[r.ID]))
	}
	return out, nil
}

// SetActive deaktiviert oder reaktiviert ein Konto. Beim Deaktivieren werden in derselben Transaktion
// alle Sitzungen des Kontos gelöscht (Anforderung 11). Das eigene Konto lässt sich nicht deaktivieren.
func (a *Accounts) SetActive(ctx context.Context, actorID, userID int64, active bool) (User, error) {
	if !active && actorID == userID {
		return User{}, ErrSelf
	}
	tx, err := a.db.BeginTx(ctx, nil)
	if err != nil {
		return User{}, err
	}
	defer tx.Rollback()
	q := a.q.WithTx(tx)
	n, err := q.SetUserActive(ctx, store.SetUserActiveParams{Active: active, ID: userID})
	if err != nil {
		return User{}, err
	}
	if n == 0 {
		return User{}, ErrNotFound
	}
	if !active {
		if err := q.DeleteUserSessions(ctx, userID); err != nil {
			return User{}, err
		}
	}
	u, err := loadUser(ctx, q, userID)
	if err != nil {
		return User{}, err
	}
	return u, tx.Commit()
}

// SetRoles ersetzt die Rollen eines Kontos (REQ-64-AC1). Admins dürfen die Admin-Rolle vergeben, aber einem
// Admin-Konto nie entziehen, auch nicht dem eigenen (REQ-64-AC3). Die Rechte gelten sofort, weil jede
// Sitzungsprüfung die Rollen neu liest. actorID ist für Protokoll und künftige Regeln vorgesehen.
func (a *Accounts) SetRoles(ctx context.Context, actorID, userID int64, roles Roles) (User, error) {
	_ = actorID
	roles, err := checkRoles(roles)
	if err != nil {
		return User{}, err
	}
	tx, err := a.db.BeginTx(ctx, nil)
	if err != nil {
		return User{}, err
	}
	defer tx.Rollback()
	q := a.q.WithTx(tx)
	cur, err := loadUser(ctx, q, userID)
	if err != nil {
		return User{}, err
	}
	if cur.Roles.Has(RoleAdmin) && !roles.Has(RoleAdmin) {
		return User{}, ErrAdminFixed
	}
	if err := writeRoles(ctx, q, userID, roles); err != nil {
		return User{}, err
	}
	u, err := loadUser(ctx, q, userID)
	if err != nil {
		return User{}, err
	}
	return u, tx.Commit()
}

// AuthorCandidates liefert die als Autor wählbaren Konten: aktiv, mit Rolle Redakteur oder Admin.
func (a *Accounts) AuthorCandidates(ctx context.Context) ([]AuthorOption, error) {
	users, err := a.Users(ctx)
	if err != nil {
		return nil, err
	}
	out := []AuthorOption{}
	for _, u := range users {
		if u.Active && u.Roles.CanAuthor() {
			out = append(out, AuthorOption{ID: u.ID, Email: u.Email, DisplayName: u.DisplayName})
		}
	}
	return out, nil
}

// CanAuthor prüft, ob ein Konto als Autor wählbar ist (aktiv, Rolle Redakteur oder Admin).
func (a *Accounts) CanAuthor(ctx context.Context, userID int64) (bool, error) {
	u, err := loadUser(ctx, a.q, userID)
	if errors.Is(err, ErrNotFound) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return u.Active && u.Roles.CanAuthor(), nil
}

// ---------------------------------------------------------------------------
// Anmeldung und Sitzungen (Anforderung 6)
// ---------------------------------------------------------------------------

// Login prüft E-Mail-Adresse und Passwort und legt eine neue Sitzung an. Nur die E-Mail-Adresse dient als
// Benutzername, nicht der Anzeigename (REQ-64-AC2).
func (a *Accounts) Login(ctx context.Context, email, password string) (Session, error) {
	row, err := a.q.GetUserByEmail(ctx, NormalizeEmail(email))
	if errors.Is(err, sql.ErrNoRows) {
		auth.SpendTime(password)
		return Session{}, ErrInvalidCredentials
	}
	if err != nil {
		return Session{}, err
	}
	if !auth.VerifyPassword(row.PasswordHash, password) || !row.Active {
		return Session{}, ErrInvalidCredentials
	}
	roles, err := rolesOf(ctx, a.q, row.ID, row.Role)
	if err != nil {
		return Session{}, err
	}
	token, err := auth.NewToken()
	if err != nil {
		return Session{}, err
	}
	csrf, err := auth.NewToken()
	if err != nil {
		return Session{}, err
	}
	now := a.now()
	expires := now.Add(SessionTTL)
	id := auth.HashToken(token)
	if err := a.q.CreateSession(ctx, store.CreateSessionParams{
		ID: id, UserID: row.ID, CsrfToken: csrf, ExpiresAt: formatTime(expires), CreatedAt: formatTime(now),
	}); err != nil {
		return Session{}, err
	}
	return Session{
		Token:     token,
		ExpiresAt: expires,
		Identity: Identity{
			UserID: row.ID, Email: row.Email, DisplayName: row.DisplayName, Roles: roles, CSRFToken: csrf, SessionID: id,
		},
	}, nil
}

// Authenticate liefert die Person zu einem Sitzungs-Cookie. Abgelaufene Sitzungen und Sitzungen
// deaktivierter Konten sind ungültig. Rollen und Kontostatus werden bei jedem Aufruf neu gelesen.
func (a *Accounts) Authenticate(ctx context.Context, token string) (Identity, error) {
	if token == "" {
		return Identity{}, ErrUnauthenticated
	}
	id := auth.HashToken(token)
	row, err := a.q.GetSession(ctx, id)
	if errors.Is(err, sql.ErrNoRows) {
		return Identity{}, ErrUnauthenticated
	}
	if err != nil {
		return Identity{}, err
	}
	if !row.Active || !a.now().Before(parseTime(row.ExpiresAt)) {
		_ = a.q.DeleteSession(ctx, id)
		return Identity{}, ErrUnauthenticated
	}
	roles, err := rolesOf(ctx, a.q, row.UserID, row.Role)
	if err != nil {
		return Identity{}, err
	}
	return Identity{
		UserID: row.UserID, Email: row.Email, DisplayName: row.DisplayName, Roles: roles, CSRFToken: row.CsrfToken, SessionID: id,
	}, nil
}

// Logout löscht die Sitzung serverseitig.
func (a *Accounts) Logout(ctx context.Context, sessionID string) error {
	return a.q.DeleteSession(ctx, sessionID)
}

// CleanupSessions löscht abgelaufene Sitzungen und liefert ihre Anzahl.
func (a *Accounts) CleanupSessions(ctx context.Context) (int64, error) {
	return a.q.DeleteExpiredSessions(ctx, formatTime(a.now()))
}

// ---------------------------------------------------------------------------
// Eigenes Profil (Ticket #64)
// ---------------------------------------------------------------------------

// Profile liefert das Profil eines Kontos. Die HTTP-Schicht übergibt nur die ID der eigenen Sitzung.
func (a *Accounts) Profile(ctx context.Context, userID int64) (Profile, error) {
	return profileOf(ctx, a.q, userID)
}

func profileOf(ctx context.Context, q *store.Queries, userID int64) (Profile, error) {
	u, err := loadUser(ctx, q, userID)
	if err != nil {
		return Profile{}, err
	}
	p := Profile{UserID: u.ID, Email: u.Email, DisplayName: u.DisplayName, Roles: u.Roles}
	m, err := q.GetUserAvatar(ctx, userID)
	switch {
	case err == nil:
		p.Avatar = &Avatar{Key: m.StorageKey, MimeType: m.MimeType, Width: int(m.Width), Height: int(m.Height)}
	case !errors.Is(err, sql.ErrNoRows):
		return Profile{}, err
	}
	return p, nil
}

// SetDisplayName speichert den Anzeigenamen (getrimmt, höchstens 80 Zeichen, leer entfernt ihn).
func (a *Accounts) SetDisplayName(ctx context.Context, userID int64, name string) (Profile, error) {
	name, err := cleanDisplayName(name)
	if err != nil {
		return Profile{}, err
	}
	n, err := a.q.SetUserDisplayName(ctx, store.SetUserDisplayNameParams{DisplayName: name, ID: userID})
	if err != nil {
		return Profile{}, err
	}
	if n == 0 {
		return Profile{}, ErrNotFound
	}
	return a.Profile(ctx, userID)
}

// SetAvatar macht ein gespeichertes Bild zum Profilbild. Zurück kommt das ersetzte Bild, dessen Dateien der
// Aufrufer nach erfolgreichem Speichern löscht.
func (a *Accounts) SetAvatar(ctx context.Context, userID int64, img media.Stored) (Profile, *MediaFile, error) {
	tx, err := a.db.BeginTx(ctx, nil)
	if err != nil {
		return Profile{}, nil, err
	}
	defer tx.Rollback()
	q := a.q.WithTx(tx)
	var old *MediaFile
	switch m, err := q.GetUserAvatar(ctx, userID); {
	case err == nil:
		old = &MediaFile{Key: m.StorageKey, MimeType: m.MimeType}
		// ON DELETE SET NULL leert users.avatar_media_id; der neue Wert folgt unten.
		if err := q.DeleteMedia(ctx, m.ID); err != nil {
			return Profile{}, nil, err
		}
	case !errors.Is(err, sql.ErrNoRows):
		return Profile{}, nil, err
	}
	mediaID, err := q.CreateMedia(ctx, store.CreateMediaParams{
		StorageKey: img.Key, MimeType: img.MimeType, Width: int64(img.Width), Height: int64(img.Height), CreatedAt: formatTime(a.now()),
	})
	if err != nil {
		return Profile{}, nil, err
	}
	n, err := q.SetUserAvatar(ctx, store.SetUserAvatarParams{AvatarMediaID: sql.NullInt64{Int64: mediaID, Valid: true}, ID: userID})
	if err != nil {
		return Profile{}, nil, err
	}
	if n == 0 {
		return Profile{}, nil, ErrNotFound
	}
	p, err := profileOf(ctx, q, userID)
	if err != nil {
		return Profile{}, nil, err
	}
	return p, old, tx.Commit()
}

// ChangePassword ändert das eigene Passwort, wenn das aktuelle stimmt (REQ-64-AC7). Andere Sitzungen des
// Kontos enden, die aktuelle bleibt gültig. Bei einem Fehler bleibt das bisherige Passwort unverändert.
func (a *Accounts) ChangePassword(ctx context.Context, id Identity, current, next string) error {
	row, err := a.q.GetUserByID(ctx, id.UserID)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrUnauthenticated
	}
	if err != nil {
		return err
	}
	if !auth.VerifyPassword(row.PasswordHash, current) {
		return ErrWrongPassword
	}
	if err := validatePassword(next); err != nil {
		return err
	}
	hash, err := auth.HashPassword(next)
	if err != nil {
		return err
	}
	tx, err := a.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	q := a.q.WithTx(tx)
	if _, err := q.SetUserPassword(ctx, store.SetUserPasswordParams{PasswordHash: hash, ID: id.UserID}); err != nil {
		return err
	}
	if err := q.DeleteOtherUserSessions(ctx, store.DeleteOtherUserSessionsParams{UserID: id.UserID, ID: id.SessionID}); err != nil {
		return err
	}
	return tx.Commit()
}
