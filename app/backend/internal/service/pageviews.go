package service

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"net/netip"
	"time"

	"ki-web/backend/internal/store"
)

// DayViews sind die Seitenaufrufe eines Kalendertags (JJJJ-MM-TT).
type DayViews struct {
	Day         string
	Views       int64
	UniqueViews *int64 // nil bei historischen oder unvollstaendigen Daten
}

// PageViewStats fasst die Seitenaufrufe eines Zeitraums zusammen, neueste Tage zuerst.
type PageViewStats struct {
	Total         int64
	UniqueTotal   *int64
	IdentitySince time.Time
	Days          []DayViews
}

// ConfigurePageViewCounting initialisiert die Zuordnung vor dem Start des HTTP-Servers.
// Ein Schluesselwechsel erhaelt Tagesaggregate, verwirft aber nicht mehr vergleichbare Pseudonyme.
func (s *Statistics) ConfigurePageViewCounting(ctx context.Context, key []byte) error {
	if len(key) != 32 {
		return fmt.Errorf("Statistikschluessel muss genau 32 Bytes enthalten")
	}
	keyID := sha256.Sum256(key)
	id := hex.EncodeToString(keyID[:])
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	q := s.q.WithTx(tx)
	old, err := q.GetPageViewIdentity(ctx)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	if old.KeyID != id {
		if err := q.DeletePageViewSources(ctx); err != nil {
			return err
		}
		now := s.now()
		// Auch nach manuellem Zuruecksetzen der Metadaten koennen alte Tageswerte bestehen.
		// Deren Vereinigung mit dem neuen Bestand ist fuer diesen Tag nicht rekonstruierbar.
		if err := q.InvalidatePageViewDay(ctx, now.In(StatsZone).Format(dayLayout)); err != nil {
			return err
		}
		if err := q.SetPageViewIdentity(ctx, store.SetPageViewIdentityParams{KeyID: id, StartedAt: now.UTC().Format(time.RFC3339)}); err != nil {
			return err
		}
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	s.ipKey = append([]byte(nil), key...)
	return nil
}

// CountPageView erhoeht den absoluten Zaehler und ordnet den Abruf atomar einem IP-Pseudonym zu.
// Ohne gueltige IP bleibt die absolute Zahl erhalten, die Bereinigung wird als unvollstaendig markiert.
// Pro IP genuegt der letzte Tag: nur dessen erster Abruf erhoeht den bereinigten Tageszaehler.
func (s *Statistics) CountPageView(ctx context.Context, ip string) error {
	day := s.now().In(StatsZone).Format(dayLayout)
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	q := s.q.WithTx(tx)
	if err := q.CountPageView(ctx, day); err != nil {
		return err
	}
	addr, err := netip.ParseAddr(ip)
	if err == nil && addr.Zone() == "" && len(s.ipKey) == 32 {
		mac := hmac.New(sha256.New, s.ipKey)
		mac.Write([]byte(addr.Unmap().String()))
		hash := hex.EncodeToString(mac.Sum(nil))
		previous, err := q.GetPageViewSource(ctx, hash)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		if previous > day {
			// Verspaeteter Abruf ueber Mitternacht oder zurueckgestellte Uhr: absolut weiterzaehlen.
			// Aus dem letzten Tag laesst sich dieser Tageswert nicht sicher rekonstruieren.
			return tx.Commit()
		}
		var newSource int64
		if previous != day {
			newSource = 1
		}
		if err := q.UpsertPageViewSource(ctx, store.UpsertPageViewSourceParams{IpHash: hash, LastDay: day}); err != nil {
			return err
		}
		if err := q.CountIdentifiedPageView(ctx, store.CountIdentifiedPageViewParams{Day: day, NewSource: newSource}); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// PageViews liefert die Seitenaufrufe im Zeitraum. Begrenzte Zeiträume enthalten jeden Tag, auch ohne
// Aufrufe, damit Lücken nicht übersehen werden. „Gesamt“ beginnt am ersten erfassten Tag und endet heute.
func (s *Statistics) PageViews(ctx context.Context, p Period) (PageViewStats, error) {
	// Alle Kennzahlen aus derselben SQLite-Momentaufnahme, auch bei gleichzeitigen Abrufen.
	tx, err := s.db.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return PageViewStats{}, err
	}
	defer tx.Rollback()
	q := s.q.WithTx(tx)
	var out PageViewStats
	identity, err := q.GetPageViewIdentity(ctx)
	configured := err == nil
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return out, err
	}
	if configured {
		out.IdentitySince, err = time.Parse(time.RFC3339, identity.StartedAt)
		if err != nil {
			return out, err
		}
	}
	// Erst die Datenbank-Momentaufnahme herstellen, dann genau einmal die Uhr lesen.
	// Eine Anfrage, die an Mitternacht auf SQLite wartet, darf Quellen des neuen Tages nicht
	// mit absoluten Tageswerten eines zuvor berechneten Zeitraums kombinieren.
	y, m, d := s.now().In(StatsZone).Date()
	end := time.Date(y, m, d, 0, 0, 0, 0, StatsZone)
	start := end
	bounded := p.days() > 0
	since := ""
	if bounded {
		start = end.AddDate(0, 0, 1-p.days())
		since = start.Format(dayLayout)
	}
	rows, err := q.ListPageViews(ctx, store.ListPageViewsParams{Since: since, Until: end.Format(dayLayout)})
	if err != nil {
		return out, err
	}
	if !bounded {
		if len(rows) == 0 {
			zero := int64(0)
			if configured {
				out.UniqueTotal = &zero
			}
			return out, nil
		}
		start, err = time.ParseInLocation(dayLayout, rows[len(rows)-1].Day, StatsZone)
		if err != nil {
			return out, err
		}
	}
	views := make(map[string]store.PageView, len(rows))
	for _, r := range rows {
		views[r.Day] = r
	}
	complete := configured
	epochDay := out.IdentitySince.In(StatsZone).Format(dayLayout)
	for date := end; !date.Before(start); date = date.AddDate(0, 0, -1) {
		day := date.Format(dayLayout)
		r := views[day]
		item := DayViews{Day: day, Views: r.Views}
		if r.Views == r.IdentifiedViews {
			unique := r.UniqueViews
			item.UniqueViews = &unique
		} else {
			complete = false
		}
		// Alte Tagesaggregate bleiben gueltig, sind aber nicht mit einem neuen Schluessel vereinbar.
		if r.Views > 0 && day < epochDay {
			complete = false
		}
		out.Total += r.Views
		out.Days = append(out.Days, item)
	}
	if complete {
		total, err := q.CountPageViewSources(ctx, since)
		if err != nil {
			return out, err
		}
		out.UniqueTotal = &total
	}
	return out, nil
}
