# 0010 Statistik: Seitenaufrufe serverseitig zählen, Ergebnisse nur mit Einwilligung

**Status:** angenommen; IP-Bereinigung durch #142 ergänzt · **Datum:** 2026-11-14 · ergänzt ADR 0009

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

## Ergänzung #142: IP-basierte Bereinigung (2026-11-14)

Diese Ergänzung wird vor der Implementierung festgehalten. „Ohne Kennung“ gilt weiter für die absoluten
Tageszähler, nicht für die IP-Bereinigung. Die Definition zählbarer Abrufe bleibt gleich.

### Daten und Aufbewahrung

- Die Client-IP wird kanonisiert (IPv4-mapped IPv6 wird IPv4) und mit HMAC-SHA-256 abgeleitet.
  Keine Klartext-IP, kein einfacher erratbarer IP-Hash. Je Ableitung wird **nur der letzte Aufruftag**
  in Europe/Berlin gespeichert: keine URLs, einzelnen Zeitpunkte, Browserdaten oder Verknüpfungen
  zu Konten, Ergebnissen oder Beratungsanfragen. Diese Daten sind pseudonym, nicht anonym.
- Der letzte Tag reicht für eindeutige IPs in den rollierenden 7-/30-Tage-Zeiträumen; die Anzahl aller
  Ableitungen ergibt „Gesamt“. Tageswerte sind getrennte Aggregate, keine Besuchsverläufe. Alle
  Zähler werden atomar in einer Transaktion aktualisiert.
- Ableitungen und Schlüssel bleiben **für die Laufzeit dieses Statistikbestands** erhalten. Auch
  lange nicht verwendete IPs müssen für „Gesamt“ wiedererkannt werden. Befristetes Löschen oder
  täglicher Schlüsselwechsel würde diese Kennzahl verfälschen. Bei Abschaltung oder Zurücksetzen
  der IP-Statistik löscht der Betreiber Ableitungen und Schlüssel, auch aus Sicherungen nach deren
  Rotation. Die Erforderlichkeit dieses Bestands prüft der Betreiber jährlich. Reine Tagesaggregate
  können bestehen bleiben.
- Der zufällige 256-Bit-Schlüssel liegt in einer separaten Datei mit restriktiven Dateirechten,
  nicht in der Datenbank, im Repository, in Logs oder der API. Er wird gesondert zugriffsgeschützt
  gesichert. Verlust/Wechsel startet einen neuen Zuordnungsbestand. Absolute Historie bleibt;
  unvollständige Tage und Zeiträume erhalten `null` statt scheinbar vollständiger Werte.
- Weiterleitungsheader zählen nur von explizit in `TRUSTED_PROXIES` konfigurierten Peers. Die Kette
  wird von rechts nach links bis zum ersten nicht vertrauenswürdigen Hop geprüft. Compose nutzt
  eine feste interne Caddy-IP ohne veröffentlichten Backend-Port. Ungültige IPs erzeugen eine
  Datenlücke statt einer gemeinsamen Besucherkennung.

### Einordnung und Einwilligung

Die Unterscheidung von Endeinrichtungszugriff und anschließender Verarbeitung bleibt maßgeblich
([DSK OH Digitale Dienste, Rn. 18–26 und 88](https://datenschutzkonferenz-online.de/media/oh/OH_Digitale_Dienste.pdf)).
Unsere technische Einordnung: Kein zusätzlicher Browserzugriff, keine JavaScript-Statistikmeldung,
keine Cookies oder Storage. Diese Erweiterung erzeugt daher keinen zusätzlichen Zugriff nach
[§ 25 TDDDG](https://www.gesetze-im-internet.de/ttdsg/__25.html).

Die serverseitigen Ableitungen sind personenbezogene Pseudonyme. Vorgesehene Rechtsgrundlage ist
Art. 6 Abs. 1 lit. f DSGVO: Interesse an der Einordnung wiederholter Abrufe. Letzter Tag statt Verlauf,
eigener Server, geschützter Schlüssel, ausschließlich Aggregate und keine Verknüpfungen begrenzen
den Eingriff. Die Aufbewahrung für „Gesamt“ muss gegen Betroffeneninteressen abgewogen werden;
Hashing ersetzt das nicht
([DSGVO Art. 4 Nr. 5, Art. 5, 6 und 21](https://eur-lex.europa.eu/legal-content/DE/ALL/?uri=CELEX%3A32016R0679)).
Die Datenschutzerklärung beschreibt Zweck, Bestand, Aufbewahrung und Widerspruch. Ihre bestehende
rechtliche Prüfung bleibt erforderlich; diese technische Bewertung bestätigt keine rechtliche
Freigabe. Der Opt-in für Ergebnisse bleibt unverändert.

### Aussagekraft

Mehrere Personen können eine IP teilen, eine Person kann mehrere IPs verwenden. Eine IP zählt je
Zeitraum einmal, in Tageswerten je Kalendertag. Periodensummen werden nicht aus Tageswerten addiert.
Historische Aufrufe ohne Zuordnung lassen sich nicht nachträglich bereinigen.
