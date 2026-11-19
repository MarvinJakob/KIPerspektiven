package web

import (
	"bytes"
	"html/template"
	"strings"
	"unicode/utf8"

	"ki-web/backend/internal/service"
)

// SiteName ist der Arbeitstitel der Webseite (Design.md: Platzhalter für Name und Logo).
const SiteName = "KI Perspektiven"

// Meta beschreibt die Angaben im <head> einer öffentlichen Seite (ARCHITECTURE.md, Abschnitt 6).
type Meta struct {
	Lang service.Lang
	// Title steht im Browser-Tab (Anforderung #108): Websitename, danach der Seitenname.
	Title string
	// SocialTitle steht in og:title und twitter:title für Vorschauen in sozialen Medien.
	SocialTitle string
	Description string
	Canonical   string
	OGType      string
	OGImage     string
	Alternates  []Alternate
	NoIndex     bool
}

// Alternate ist ein Verweis auf eine Übersetzung (hreflang).
type Alternate struct {
	Hreflang string
	Href     string
}

func (m Meta) OGLocale() string {
	if m.Lang == service.EN {
		return "en_GB"
	}
	return "de_DE"
}

var headTmpl = template.Must(template.New("head").Parse(`<title>{{.Title}}</title>
    <meta name="description" content="{{.Description}}">
{{- if .NoIndex}}
    <meta name="robots" content="noindex">
{{- end}}
{{- if .Canonical}}
    <link rel="canonical" href="{{.Canonical}}">
{{- end}}
{{- range .Alternates}}
    <link rel="alternate" hreflang="{{.Hreflang}}" href="{{.Href}}">
{{- end}}
    <meta property="og:site_name" content="` + SiteName + `">
    <meta property="og:type" content="{{.OGType}}">
    <meta property="og:title" content="{{.SocialTitle}}">
    <meta property="og:description" content="{{.Description}}">
{{- if .Canonical}}
    <meta property="og:url" content="{{.Canonical}}">
{{- end}}
    <meta property="og:locale" content="{{.OGLocale}}">
{{- if .OGImage}}
    <meta property="og:image" content="{{.OGImage}}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="{{.OGImage}}">
{{- else}}
    <meta name="twitter:card" content="summary">
{{- end}}
    <meta name="twitter:title" content="{{.SocialTitle}}">
    <meta name="twitter:description" content="{{.Description}}">`))

const (
	headStart = "<!--app-head-->"
	headEnd   = "<!--/app-head-->"
)

// render setzt die Meta-Angaben in die index.html des Frontend-Builds ein.
// Die Vorlage enthält zwischen <!--app-head--> und <!--/app-head--> einen Standardtitel,
// der ersetzt wird, sowie <html lang="de">.
func render(index []byte, m Meta) ([]byte, error) {
	var head bytes.Buffer
	if err := headTmpl.Execute(&head, m); err != nil {
		return nil, err
	}
	s := string(index)
	if i, j := strings.Index(s, headStart), strings.Index(s, headEnd); i >= 0 && j > i {
		s = s[:i] + head.String() + s[j+len(headEnd):]
	}
	s = strings.Replace(s, `<html lang="de"`, `<html lang="`+string(m.Lang)+`"`, 1)
	return []byte(s), nil
}

// texts enthält die Seitentitel und Beschreibungen für Seiten ohne Datenbankinhalt.
// Die Beschreibungen von Startseite und Profil stehen gleichlautend in frontend/src/i18n/home.ts und
// frontend/src/i18n/profile.ts, die Texte der Readiness-Auswertung in frontend/src/i18n/{de,en}.ts
// (assess.resultTitle, assess.resultMeta). Der Seitentitel soll nach dem Laden nicht wechseln (Bug #126).
//
// <seite>.title steht in der Social-Media-Vorschau. Für den Browser-Tab (Anforderung #108) gilt <seite>.name,
// die kurze Bezeichnung aus der Navigation (frontend: nav.profile); ohne diesen Schlüssel gilt <seite>.title.
// Die Startseite hat im Tab keinen Seitennamen.
var texts = map[service.Lang]map[string]string{
	service.DE: {
		"profile.name":          "Profil",
		"profile.title":         "Marvin Jakob – Profil",
		"profile.desc":          "Marvin Jakob, Creative IT Specialist: Technologie verstehen. KI in der Praxis nutzen. Beratung zu KI-Einsatz, Datenstrategie und Agentic AI.",
		"home.title":            "KI verstehen. Sinnvoll einsetzen.",
		"home.desc":             "Praxiswissen für den professionellen Einsatz von KI. Mit klarem Blick auf Nutzen, Grenzen und Verantwortung.",
		"aiUses.title":          "Wofür KI heute eingesetzt wird",
		"understandAi.title":    "KI verstehen",
		"understandAi.desc":     "Wie Sprachmodelle und KI-Agenten funktionieren und wie fünf Disziplinen helfen, bessere KI-Ergebnisse zu erreichen.",
		"aiUses.desc":           "Sieben typische Aufgaben von KI mit belegten Beispielen und Zahlen zur KI-Nutzung in Deutschland.",
		"blog.title":            "News",
		"blog.desc":             "Alle veröffentlichten Beiträge rund um KI – die neuesten zuerst.",
		"contact.title":         "Kontakt",
		"contact.desc":          "Schreib uns eine Nachricht – mit deinen Kontaktdaten, damit wir antworten können.",
		"imprint.title":         "Impressum",
		"imprint.desc":          "Impressum von " + SiteName + ".",
		"privacy.title":         "Datenschutz",
		"privacy.desc":          "Datenschutzerklärung von " + SiteName + ".",
		"readinessResult.title": "Auswertung der Selbsteinschätzung",
		"readinessResult.desc":  "Die gewählten Reifegrade aller Dimensionen der KI-Readiness-Selbsteinschätzung.",
		"notFound.title":        "Seite nicht gefunden",
		"notFound.desc":         "Diese Seite gibt es nicht oder sie ist nicht öffentlich.",
	},
	service.EN: {
		"profile.name":          "Profile",
		"profile.title":         "Marvin Jakob – Profile",
		"profile.desc":          "Marvin Jakob, Creative IT Specialist: understand technology. Use AI in practice. Consulting on AI adoption, data strategy and agentic AI.",
		"home.title":            "Understand AI. Use it wisely.",
		"home.desc":             "Practical knowledge for the professional use of AI. With a clear view of benefits, limits and responsibility.",
		"aiUses.title":          "What AI is used for today",
		"aiUses.desc":           "Seven typical tasks of AI with documented examples and figures on AI use in Germany.",
		"blog.title":            "News",
		"blog.desc":             "All published articles about AI – newest first.",
		"contact.title":         "Contact",
		"contact.desc":          "Send us a message – with your contact details so that we can reply.",
		"imprint.title":         "Legal notice",
		"imprint.desc":          "Legal notice of " + SiteName + ".",
		"privacy.title":         "Privacy",
		"privacy.desc":          "Privacy policy of " + SiteName + ".",
		"readinessResult.title": "Self-assessment results",
		"readinessResult.desc":  "The chosen maturity levels of all dimensions of the AI readiness self-assessment.",
		"notFound.title":        "Page not found",
		"notFound.desc":         "This page does not exist or is not public.",
	},
}

func text(l service.Lang, key string) string { return texts[l][key] }

// pageName liefert den Seitennamen einer Seite ohne Datenbankinhalt für den Browser-Tab.
func pageName(l service.Lang, key string) string {
	if name := text(l, key+".name"); name != "" {
		return name
	}
	return text(l, key+".title")
}

// tabTitle bildet den Titel im Browser-Tab (Anforderung #108): Websitename, genau ein Leerzeichen, Seitenname.
// Ohne Seitennamen, etwa auf der Startseite, bleibt der Websitename. Gleichlautend in frontend/src/lib/page.ts.
func tabTitle(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return SiteName
	}
	return SiteName + " " + name
}

// socialTitle bildet den Titel für Vorschauen in sozialen Medien (og:title, twitter:title).
func socialTitle(t string) string { return t + " · " + SiteName }

// excerpt kürzt einen Text für die Meta-Beschreibung an einer Wortgrenze.
func excerpt(s string, limit int) string {
	s = strings.Join(strings.Fields(s), " ")
	if utf8.RuneCountInString(s) <= limit {
		return s
	}
	r := []rune(s)[:limit]
	cut := string(r)
	if i := strings.LastIndex(cut, " "); i > limit/2 {
		cut = cut[:i]
	}
	return strings.TrimRight(cut, " ,.;:–-") + " …"
}
