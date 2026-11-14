# 0011 Beratungsanfragen in der Datenbank ablegen und in der Redaktion bereitstellen

**Status:** angenommen · **Datum:** 2026-11-14 · ergänzt ADR 0010 (öffentliche Schreibzugriffe)

## Kontext

Ticket #136 verlangt auf der Auswertung der KI-Readiness-Selbsteinschätzung ein Kontaktformular für ein
kostenloses Beratungsgespräch. Pflichtfeld ist allein die E-Mail-Adresse. Eine gültige Anfrage muss
„zuverlässig für die zuständige Beratung bereitgestellt“ werden, ihr Eingang muss bei der Abnahme nachweisbar
sein. Empfänger bzw. Ablage und Übermittlungsweg sind bei der Umsetzung festzulegen und zu dokumentieren; ein
`mailto:`-Link reicht ausdrücklich nicht. Die Bestätigung darf erst nach erfolgreicher Übermittlung erscheinen.

Möglich waren:

1. **E-Mail-Versand per SMTP** an ein Beratungspostfach. Das braucht einen Mailanbieter, Zugangsdaten auf dem
   Server und einen Auftragsverarbeiter mehr. Ob die Mail ankommt, weiß das Backend nach der Annahme durch den
   Mailserver nicht; Spamfilter und Zustellfehler bleiben unsichtbar.
2. **Ablage in der eigenen Datenbank** und Anzeige in der Redaktion. Die Anwendung hat SQLite, Konten,
   Rollen und eine Redaktionsoberfläche bereits (ADR 0003, ADR 0005). Gelingt das Speichern, ist die Anfrage
   bereitgestellt; das Backend kann den Erfolg also zuverlässig bestätigen.

## Entscheidung

- **Ablage:** `POST /api/consultation-requests` speichert E-Mail-Adresse, Sprache der Seite und Zeitpunkt in
  der Tabelle `consultation_requests` (Migration `00013`). Erst nach erfolgreichem Speichern antwortet das
  Backend mit `204`, erst dann zeigt das Frontend die Bestätigung. Es gibt keine weiteren Felder, auch das
  Ergebnis der Selbsteinschätzung wird nicht übertragen (Datenminimierung).
- **Empfänger:** Die Redaktion sieht die Anfragen unter `/redaktion/beratungsanfragen` (Navigation
  „Beratungsanfragen“, Rollen `editor` und `admin`, wie die Statistik aus #130). Sie meldet sich per E-Mail
  zur Terminabstimmung und löscht die Anfrage danach (`DELETE /api/admin/consultation-requests/{id}`, mit
  CSRF-Token).
- **Prüfung:** Frontend und Backend prüfen die Adresse. Das Frontend prüft grob (ein `@`, keine Leerzeichen,
  Punkt in der Domain, höchstens 254 Zeichen), maßgeblich ist das Backend (`net/mail`, eine einzelne Adresse
  ohne Namen, Punkt in der Domain, höchstens 254 Zeichen; dieselbe Prüfung wie für Redaktionskonten). Leere
  und ungültige Adressen beantwortet es mit `422`. Adressen werden ohne Leerzeichen und kleingeschrieben
  gespeichert; eine erneute Anfrage mit derselben Adresse aktualisiert Sprache und Zeitpunkt, statt einen
  zweiten Eintrag anzulegen. So bleibt erneutes Senden nach einem Netzfehler folgenlos.
- **Missbrauchsschutz:** Wie alle öffentlichen Schreibzugriffe prüft der Endpunkt die Herkunft (`403`) und
  nimmt höchstens 4 KiB an (`413`). Zusätzlich nimmt er je IP-Adresse höchstens fünf Anfragen pro Stunde an
  (`429`). Anders als bei der anonymen Statistik (ADR 0010) entstehen hier personenbezogene Einträge; ohne
  Begrenzung ließen sich massenhaft fremde Adressen eintragen. Die Zähler liegen wie bei der Begrenzung der
  Anmeldeversuche nur im Arbeitsspeicher und verfallen nach einer Stunde.
- **Protokoll:** Das Backend protokolliert den Eingang ohne Adresse (ARCHITECTURE.md, Abschnitt 10).

## Konsequenzen

- Neue Anfragen erscheinen nur in der Redaktion; es gibt keine Benachrichtigung. Die Redaktion muss
  `/redaktion/beratungsanfragen` regelmäßig ansehen. Eine Benachrichtigung per E-Mail ließe sich später
  ergänzen, ohne die Ablage zu ändern; sie bräuchte SMTP-Zugangsdaten und ein neues ADR.
- E-Mail-Adressen sind personenbezogene Daten. Sie stehen in der Datenbank und damit auch in deren
  Sicherungen (Betriebsanleitung). Die Datenschutzerklärung nennt Zweck, Speicherdauer und Rechtsgrundlage.
  Gelöschte Anfragen verschwinden aus den Sicherungen erst mit deren Ablauf.
- Personen hinter einer gemeinsamen IP-Adresse (z. B. ein Firmennetz) teilen sich die fünf Anfragen pro
  Stunde. Ungültige Eingaben zählen nicht mit.
