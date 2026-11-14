# 0010 Statistik: Seitenaufrufe serverseitig zählen, Ergebnisse nur mit Einwilligung

**Status:** angenommen · **Datum:** 2026-11-14 · ergänzt ADR 0009 (Auswertung bisher nur im Browser)

## Kontext

Ticket #130 verlangt eine Statistik in der Redaktion: Seitenaufrufe und die Ergebnisse der
KI-Readiness-Selbsteinschätzung. Bisher gab es keine Reichweitenmessung (ARCHITECTURE.md, Abschnitt 11),
und die Selbsteinschätzung übertrug nichts (ADR 0009). Das Ticket schließt Cookies, Web Storage und Kennungen
aus und verlangt eine Einordnung nach § 25 TDDDG. Ist eine Einwilligung nötig, wird das Vorgehen vorher
abgestimmt.

Rechtliche Einordnung (technische Bewertung, keine Rechtsberatung):

- § 25 Abs. 1 TDDDG verlangt eine Einwilligung für das Speichern von Informationen in der Endeinrichtung
  und für den Zugriff auf dort gespeicherte Informationen, unabhängig vom Personenbezug
  ([DSK, OH Digitale Dienste, Version 1.2, Rn. 26](https://datenschutzkonferenz-online.de/media/oh/OH_Digitale_Dienste.pdf)).
- Der EDSA wertet JavaScript, das den Browser anweist, Informationen per Anfrage an einen Server zu senden,
  ausdrücklich als Zugriff ([Leitlinien 2/2023, Version 2.0, Rn. 33](https://edpb.europa.eu/system/files/2024-10/edpb_guidelines_202302_technical_scope_art_53_eprivacydirective_v2_en_0.pdf)).
  Auch der Arbeitsspeicher zählt als Speichermedium (Rn. 38). Ausnahmen behandeln die Leitlinien nicht (Rn. 4, 40).
- Ohne Einwilligung bleibt nur die Ausnahme „unbedingt erforderlich“ (§ 25 Abs. 2 Nr. 2 TDDDG). Die DSK hält
  selbst die einfache Messung von Besucherzahlen nicht per se für erforderlich; es komme auf den Zweck an
  (OH Digitale Dienste, Rn. 77 und 90). Der Zweck hier, Reichweite und Bedarf einzuschätzen, dient vor allem
  der Redaktion.
- Als einfache Reichweitenmessung nennt die DSK, bei jedem Abruf einer Seite einen Zähler zu erhöhen oder
  Logdateien ohne personenbezogene Daten auszuwerten (Rn. 88). Der Abruf einer Seite geht vom Browser aus;
  die Webseite liest dabei nichts aus der Endeinrichtung aus.

Daraus folgt: Eine Meldung von Seitenwechseln per JavaScript bräuchte voraussichtlich eine Einwilligung, das
Zählen ausgelieferter Seiten auf dem Server nicht. Auch das Senden eines Ergebnisses der Selbsteinschätzung
ist ein Zugriff, den die Auswertung selbst nicht braucht; ein bloßer Hinweis ersetzt keine Einwilligung.
Marvin Jakob hat am 2026-11-14 entschieden: serverseitig zählen, Ergebnisse nur mit Opt-in speichern.

## Entscheidung

- **Seitenaufrufe:** Das Backend erhöht beim Ausliefern einer öffentlichen Seite (`GET`, Status `200`, kein
  Prefetch) den Zähler des Kalendertags in Europe/Berlin. Die Tabelle `page_views` hat nur Datum und Anzahl.
  Das Frontend meldet nichts. Seitenwechsel innerhalb der Anwendung zählen deshalb nicht, Neuladen und
  Direktaufrufe schon. Redaktionsseiten, API, Dateien und Fehlerseiten zählen nicht.
- **Ergebnisse:** Vor „Auswertung anzeigen“ und auf der Auswertung steht ein nicht vorausgewähltes
  Kontrollkästchen mit Hinweis und Link zur Datenschutzerklärung. Nur mit Haken sendet das Frontend beim
  Anzeigen der vollständigen Auswertung Reifegrade, Sprache und eine zufällige Kennung (128 Bit) an
  `POST /api/readiness-results`. Die Auswertung erscheint in jedem Fall.
- **Aktualisieren statt verdoppeln:** Die Kennung entsteht im Browser und liegt nur im Arbeitsspeicher des
  Fensters. Das Backend speichert nur ihren SHA-256-Hash und aktualisiert damit dasselbe Ergebnis. Die
  Kennung steht im Anfragetext, nicht in der URL, damit sie nicht neben der gekürzten IP-Adresse im
  Zugriffsprotokoll von Caddy landet. Entfernen des Hakens löscht das Ergebnis
  (`DELETE /api/readiness-results/{key}`); zu diesem Zeitpunkt gibt es nichts mehr zu verknüpfen.
- **Prüfung:** Das Backend nimmt nur vollständige Ergebnisse an: jede freigegebene Dimension genau einmal,
  Reifegrad 1 bis 3, Sprache `de` oder `en`. Öffentliche Schreibzugriffe prüfen die Herkunft und sind auf
  4 KiB begrenzt.
- **Kein externes Werkzeug:** Ein Analysewerkzeug wie Umami (ARCHITECTURE.md, frühere Fassung) entfällt; der
  Tageszähler reicht für den Zweck und erhebt weniger Daten.

## Konsequenzen

- Kein Einwilligungsbanner und kein optionaler Zweck in den Cookie-Einstellungen (#56) nötig.
- Die Zahl „Seitenaufrufe“ ist eine Untergrenze für die tatsächlich angesehenen Seiten und enthält auch
  automatische Abrufe, etwa durch Suchmaschinen. Die Redaktion sieht dazu einen Hinweis.
- Die Zahl der Ergebnisse umfasst nur Personen, die zugestimmt haben.
- Öffentliche Schreibzugriffe sind nicht mengenbegrenzt. Wer viele Anfragen schickt, kann die Statistik
  verfälschen. Eine Begrenzung je IP-Adresse wäre möglich, verarbeitet aber IP-Adressen und ist bewusst
  nicht Teil von #130.
- Sollen später Seitenwechsel innerhalb der Anwendung zählen, braucht es eine Einwilligung über die
  Cookie-Einstellungen. Das ersetzt diese Entscheidung durch ein neues ADR.
