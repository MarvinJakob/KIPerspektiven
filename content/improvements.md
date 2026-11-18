# KI Perspektiven – Verbesserungsvorschläge

Grundlage ist der lokale Entwicklungsstand `cb9a70a` vom 18. November 2026 mit Testbeiträgen. Startseite, Blog, Kontakt, „KI verstehen“ und KI Readiness wurden in Edge bei 1.280 und 390 Pixeln Breite geöffnet. Weitere Vorschläge stützen sich auf die Artikel, Komponenten und den lokalen Produktionsbuild.

## 20 Vorschläge für Inhalt, Qualität und Betrieb

1. **Datenschutzerklärung vervollständigen.** Unter „Datenschutz“ stehen „Platzhalter“ und „[Name, Anschrift, Kontakt]“. Betreiberangaben und tatsächliche Datenverarbeitung für Kontakt, Beratung und Statistik in DE und EN prüfen und die freigegebene Fassung veröffentlichen.
2. **„KI verstehen“ ins Englische übertragen.** Unter `/en/ki-verstehen` bleiben Seitentitel, Überschrift und Artikel deutsch. Auch Bildbeschreibungen und Suchvorschau übersetzen, damit die englische Seite eigenständig lesbar ist.
3. **Den Prozessbericht zeitlich einordnen.** „KI in der Softwareentwicklung“ beschreibt drei Teams. Einen datierten Nachtrag zum heutigen Ablauf mit einem verantwortlichen Agenten ergänzen. So bleiben die damalige Erfahrung und die aktuelle Arbeitsweise nachvollziehbar.
4. **Den Startseitentext lektorieren.** Im Abschnitt zu Guardrails „die kontrolle“ korrigieren und den Satz „Die Verantwortung für das Ergebnis bleibt bei uns aber …“ gliedern. Die Korrekturen in Textvorlage und Veröffentlichung abgleichen.
5. **Den Themenindex mit dem Inhalt abgleichen.** Der Index auf der Startseite enthält nur „Softwareentwicklung“, während der Abschnitt auch „Vibe Coding“ anbietet. Beide Artikel mit ihrem konkreten Schwerpunkt direkt im Index verzeichnen.
6. **Den Grundlagenartikel mit den Einsatzfeldern verbinden.** Nach der Erklärung von Sprachmodellen auf „Wofür KI heute eingesetzt wird“ verweisen. Dort können Leser die Erklärung an sieben dokumentierten Aufgaben überprüfen.
7. **Kennzahlen vergleichbar machen.** Bei den 26, 57 und 32,3 Prozent unter „KI-Einsatzfelder“ jeweils Grundgesamtheit und Erhebungszeitraum nennen. So lässt sich etwa der Wert für Einzelpersonen von der KI-Nutzung in Unternehmen unterscheiden.
8. **Beispiele genauer belegen.** Für „Auffälligkeiten entdecken“ einen konkreten dokumentierten Fall der Betrugserkennung direkt am Beispiel verlinken. Leser können dann nachvollziehen, welche Auffälligkeit tatsächlich gefunden wurde.
9. **Die fünf Engineering-Disziplinen an einem Fall erklären.** In „KI verstehen“ ein Beispiel wie die Bearbeitung einer Supportanfrage durch alle fünf Abschnitte führen. Je Disziplin zeigen, welche Entscheidung sie verändert.
10. **Beim Vibe-Coding-Beispiel das Ergebnis zeigen.** Die vorhandene User Story um einen beobachteten Fehlversuch und ein erfülltes Abnahmekriterium ergänzen. Damit wird nachvollziehbar, wie sich die Qualität der erzeugten Lösung prüfen lässt.
11. **Reifegrade mit Arbeitsbeispielen kalibrieren.** Für „Strategie und Wirtschaftlichkeit“ denselben KI-Piloten auf allen drei Stufen beschreiben. Der Unterschied wird an Entscheidungen und Nachweisen im Betrieb greifbar.
12. **Die Readiness-Auswertung an einem Muster erläutern.** Unter der fachlichen Einordnung ein ausdrücklich fiktives Profil mit ungleichen Stufen besprechen. So wird verständlich, wann eine niedrige Stufe für ein Unternehmen ausreichen kann.
13. **Beratungsergebnisse greifbar machen.** Bei den Angeboten im Profil je einen anonymisierten Beispielausschnitt zeigen, etwa eine priorisierte Liste von Anwendungsfällen. Interessenten sehen, was sie nach einem Workshop in der Hand haben.
14. **Profil und Fachartikel verbinden.** Aussagen zur Erfahrung mit Agenten auf der Profilseite direkt mit dem eigenen Prozessbericht belegen. Interessenten können Arbeitsweise und Beratungsaussagen miteinander abgleichen.
15. **Beiträge redaktionell zuordnen.** In der Blog-Detailansicht neben Datum und Lesezeit den verantwortlichen Autor nennen und, sofern vorhanden, zum Profil verlinken. So ist erkennbar, wer die Einschätzung vertritt.
16. **Überarbeitete Beiträge kennzeichnen.** Neben dem Veröffentlichungsdatum den letzten fachlichen Änderungsstand samt kurzem Änderungshinweis ausgeben. Leser erkennen, ob neue Erkenntnisse in einen älteren Beitrag eingeflossen sind.
17. **Verwandte Artikel breiter auswählen.** Die Beitragsseite nutzt nur das erste zugeordnete Thema für Empfehlungen. Überschneidungen über alle Themen berücksichtigen, damit ein passender Beitrag zum zweiten Thema ebenfalls gefunden wird.
18. **Den Blog in Portionen ausliefern.** Die Übersicht lädt die gesamte veröffentlichte Liste. Eine feste Seitengröße mit stabiler Sortierung nach Datum und ID einführen, damit auch ein größerer Bestand zügig lädt.
19. **Das Startpaket verkleinern.** Der lokale Build erzeugt für die öffentliche Seite rund 745 kB JavaScript vor Kompression. Markdown-Darstellung und Readiness-Auswertung erst beim jeweiligen Seitenaufruf laden und die übertragene Größe für einen ersten Startseitenbesuch vergleichen.
20. **Quellenlinks regelmäßig prüfen.** Bei den vorhandenen Belegen tote Ziele und unerwartete Weiterleitungen regelmäßig an die Redaktion melden. So bleibt der Weg von einer fachlichen Aussage zur Originalquelle nutzbar.

## 20 Vorschläge für Usability und UX-Design

1. **„News“ in „Blog“ umbenennen.** Auf der Startseite „Zum Blog“ verwenden. Kopfzeile, Link und Zielüberschrift bezeichnen dann dasselbe Angebot.
2. **Den Einstieg auf Mobilgeräten entzerren.** Von den fünf Aktionen unter der Hauptüberschrift die beiden Besucherziele „Themen entdecken“ und „KI-Reifegrad einschätzen“ zusammen hervorheben. Die übrigen Links in Navigation und passenden Inhaltsabschnitten zugänglich halten.
3. **Den Readiness-Einstieg einheitlich benennen.** Den Bannerlink „Zum KI-Audit“ in „Zur Selbsteinschätzung“ ändern. So ist vor dem Klick klar, dass Besucher die Bewertung selbst durchführen.
4. **Den Lesepfad auf der Startseite abkürzen.** Den Link zum Softwareartikel bereits nach der Leitfrage anbieten und am Abschnittsende wiederholen. Eilige Leser erreichen den Artikel vor den zwölf einleitenden Absätzen.
5. **Abschnittslinks teilbar machen.** Beim Klick auf einen Perspektiven-Link in „Vibe Coding“ den Abschnitt in die URL übernehmen und den vorhandenen Tastaturfokus erhalten. Eine kopierte Adresse öffnet dann die besprochene Stelle.
6. **„KI verstehen“ mit einem Inhaltsverzeichnis erschließen.** Der Hauptinhalt war bei 390 Pixeln Breite rund 7.700 Pixel lang. Unter der Überschrift Sprunglinks etwa zu „Vom Sprachmodell zum Agenten“ und zu den fünf Disziplinen anbieten.
7. **Nach einem Quellenaufruf zur Lesestelle zurückführen.** In „KI-Einsatzfelder“ bei der angesprungenen Quelle einen Rücksprung zum zuletzt benutzten Beleg anbieten. Bei mehrfach zitierter Quelle landet man so wieder am richtigen Beispiel.
8. **Prozessgrafiken direkt im Artikel vergrößern.** Die Grafik als beschriftete, per Tastatur bedienbare Großansicht öffnen. Beim Schließen mit Escape oder „Schließen“ den Fokus auf die Ausgangsgrafik zurücksetzen.
9. **Die Lesezeit vor dem Öffnen zeigen.** Den vorhandenen Minutenwert eines Blogbeitrags auch beim Datum in der Übersicht anzeigen. So lässt sich ein Beitrag für eine kurze Lesepause auswählen.
10. **Auf der 404-Seite konkrete Auswege anbieten.** Neben „Startseite“ zu „Blog“ und „KI Readiness“ verlinken. Wer einem alten Artikellink folgt, kann direkt im passenden Bereich weitersuchen.
11. **Die Readiness-Schrittliste mobil einklappen.** Beim ersten Schritt lag die Auswahl bei 390 Pixeln Breite rund 1.800 Pixel unter dem oberen Rand. Zuerst aktuellen Schritt und Fortschritt zeigen, die vollständige Liste auf Wunsch öffnen.
12. **Den Aufwand vor dem Start sichtbar machen.** Direkt beim ersten Startknopf die Anzahl der Dimensionen, die drei Wahlmöglichkeiten je Dimension und den Verlust der Auswahl beim Neuladen nennen. Besucher können entscheiden, ob sie jetzt beginnen.
13. **Prüffragen auf Wunsch aufklappen.** Bei der Reifegradwahl zunächst alle drei Stufennamen und Kurzbeschreibungen zeigen. Die zugehörigen Fragen je Stufe aufklappbar halten, damit sich die Alternativen auf kleinen Displays leichter vergleichen lassen.
14. **Die ganze Reifegradbeschreibung auswählbar machen.** Zum Auswählen auch den Beschreibungstext der Karte als Klickfläche nutzen. Auswahlmarkierung und Tastaturbedienung bleiben dabei eindeutig.
15. **Nach einer Korrektur direkt zur Auswertung führen.** Wer in der Ergebnistabelle „Ändern“ wählt, erhält nach der Auswahl „Zurück zur Auswertung“. Die korrigierte Tabellenzeile wieder fokussieren, damit der Vergleich weitergehen kann.
16. **Werte im Netzdiagramm per Antippen und Tastatur öffnen.** Der Tooltip reagiert auf den Mauszeiger. Achsenpunkte auch per Fokus und Touch mit Dimensionsname und Stufe beschriften, besonders in der schmalen Ansicht mit nummerierten Achsen.
17. **Bei langen Kontaktnachrichten die Restlänge zeigen.** Nahe der Grenze von 5.000 Zeichen einen Zähler am Textfeld einblenden. Wer längeren Text einfügt, erkennt, ob die ganze Nachricht hineinpasst.
18. **Formularfehler bis zur Korrektur sichtbar halten.** Der E-Mail-Fehler verschwindet schon mit dem nächsten Tastendruck. Nach dem ersten Sendeversuch erneut prüfen und den Hinweis erst bei plausibler Adresse entfernen.
19. **Kontakt aus einem Beratungsangebot ermöglichen.** Unter jedem Angebot „Zu diesem Angebot anfragen“ zum vorhandenen Kontaktformular setzen und den Angebotsnamen als bearbeitbaren Bezug übernehmen. Das spart Scrollen und erneutes Erklären.
20. **Die Speicherwahl verständlich beschriften.** Im Cookie-Dialog die konkrete Wirkung in den Schaltflächen nennen, etwa „Sprache und Darstellung merken“ und „Nur für diesen Besuch“. Damit ist auch ohne Kenntnis von Browser-Speichern klar, was beim nächsten Besuch passiert.
