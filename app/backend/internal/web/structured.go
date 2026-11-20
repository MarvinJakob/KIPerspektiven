package web

import (
	"time"

	"ki-web/backend/internal/service"
)

// Strukturierte Daten (JSON-LD, schema.org) und Standard-Vorschaubild für indexierbare Seiten (Anforderung #124).
// Die Blöcke verwenden nur Texte, die die Seite bereits führt: Websitename, Seitenname, Meta-Beschreibung,
// Titel und Zusammenfassung.

// AuthorName ist Autor und Herausgeber aller Beiträge (Ticket #124, Entscheidung E1): eine Person, keine Organisation.
const AuthorName = "Marvin Jakob"

// Standard-Vorschaubild für Seiten ohne eigenes Titelbild (Ticket #124, Entscheidung E2).
// Die Datei liegt in frontend/public und wird wie favicon.svg aus dem Wurzelverzeichnis des Builds ausgeliefert.
const (
	defaultImagePath   = "/vorschaubild-1200x630.png"
	defaultImageWidth  = 1200
	defaultImageHeight = 630
)

var defaultImageAlt = map[service.Lang]string{
	service.DE: "Logo von " + SiteName,
	service.EN: SiteName + " logo",
}

type jsonLD = map[string]any

func (s *Site) defaultImage() string { return s.baseURL + defaultImagePath }

// describe ergänzt eine indexierbare Seite um ihre strukturierten Daten und, ohne eigenes Bild, um das
// Standard-Vorschaubild. Nicht indexierbare Seiten erhalten beides nicht.
func (s *Site) describe(m Meta, ld jsonLD) Meta {
	if m.OGImage == "" {
		m.OGImage = s.defaultImage()
		m.OGImageWidth, m.OGImageHeight = defaultImageWidth, defaultImageHeight
		m.OGImageAlt = defaultImageAlt[m.Lang]
	}
	ld["@context"] = "https://schema.org"
	m.JSONLD = ld
	return m
}

// webSite beschreibt die Website in der Sprache der angezeigten Fassung.
func (s *Site) webSite(lang service.Lang) jsonLD {
	return jsonLD{"@type": "WebSite", "name": SiteName, "url": s.url(lang, ""), "inLanguage": string(lang)}
}

// webPage beschreibt eine Seite mit ihrem Seitennamen und ihrer Meta-Beschreibung.
func (s *Site) webPage(m Meta, name string) jsonLD {
	return jsonLD{
		"@type": "WebPage", "name": name, "description": m.Description, "url": m.Canonical,
		"inLanguage": string(m.Lang), "isPartOf": s.webSite(m.Lang),
	}
}

func (s *Site) author(lang service.Lang) jsonLD {
	return jsonLD{"@type": "Person", "name": AuthorName, "url": s.url(lang, "/profil")}
}

// profilePage beschreibt die Profilseite mit der Person als Hauptinhalt.
func (s *Site) profilePage(m Meta, name string) jsonLD {
	ld := s.webPage(m, name)
	ld["@type"] = "ProfilePage"
	ld["mainEntity"] = s.author(m.Lang)
	return ld
}

// blogPosting beschreibt einen veröffentlichten Beitrag. image ist das Titelbild oder das Standard-Vorschaubild.
func (s *Site) blogPosting(m Meta, p service.Post, image string) jsonLD {
	return jsonLD{
		"@type": "BlogPosting", "headline": p.Title, "description": p.Summary,
		"datePublished": m.PublishedTime, "dateModified": m.ModifiedTime,
		"inLanguage": string(m.Lang), "mainEntityOfPage": m.Canonical, "image": image,
		"author": s.author(m.Lang), "publisher": s.author(m.Lang),
	}
}

// timestamp schreibt einen Zeitpunkt wie die öffentliche API (ISO 8601, JSON-Form von time.Time).
func timestamp(t time.Time) string { return t.Format(time.RFC3339Nano) }
