# Team 1 – Analyst

Gilt zusätzlich zu [AGENTS.md](AGENTS.md). Branch `spec/<n>`, Änderungen nur in `fidelity/specs/` und `fidelity/tests/`.

**Ziel:** Anforderungen vollständig spezifizieren und Fidelity-Tests erstellen. Team 1 prüft durch Lesen; Laufzeitvalidierung und Gegenproben übernimmt Team 2.

1. Älteste freie Anforderung in `Neu` / `Ready` wählen, auch ohne Labels. `claim spec <n>`, fehlende `requirement` und `needs-analysis` ergänzen, Board `In Arbeit` setzen und prüfen.
2. Issue lesen. Jede fachliche Aussage als Akzeptanzkriterium oder ausdrücklich unter „Nicht Teil der Anforderung“ erfassen. Fehlende fachliche Entscheidungen als Blocker dokumentieren.
3. `fidelity/specs/REQ-<n>.md` nach [_VORLAGE.md](fidelity/specs/_VORLAGE.md). SMART-Kriterien, von außen über Browser oder HTTP beobachtbar. IDs `REQ-<n>-AC<m>` fortlaufend und nie wiederverwenden.
4. Genau ein Playwright-Test pro Kriterium in `fidelity/tests/REQ-<n>.spec.ts`; Titel beginnt mit ID. Rollen und sichtbare Texte statt CSS-Klassen oder Interna. Seed/Testdaten, unabhängige Tests auf Desktop und Mobil. Kein Skip, Fixme oder erwarteter Fehlschlag.
5. Durch Lesen Vollständigkeit, Selektoren, Daten und Unabhängigkeit prüfen. Keine Anwendung starten, keine Tests und keine Gegenproben ausführen. `status: entwurf`, `geprueft_am` leer; keine Laufzeitprüfung abhaken.
6. Rebase, Push, Draft-PR mit `Refs #<n>`, Implementierer-IDs und Hinweis „Tests nicht ausgeführt; Laufzeitvalidierung durch Team 2 ausstehend“. Keine `Fidelity:`-Pflicht-IDs für unimplementierte Kriterien. Das Merge Gate führt nur die Tests dieses Features aus; neue fachliche Fehler sind zulässiger Backlog.
7. Nach erfolgreichen technischen Prüfungen an Team 4 übergeben: Board `Review`, Status prüfen, `pause spec <n>`. Team 4 reviewed den Quelltext, merged nach grünem Gate und führt `finish` aus. Der Prozessabgleich setzt danach `specified`; Team 2 prüft zur Laufzeit.

Team 1 implementiert keine Funktionen, ändert keine Baseline und bearbeitet keine Testdefekt-Tickets. Testdefekte gehören Team 3. Fachlich ersetzte Kriterien erhalten neue IDs; Baseline-IDs entfernt nur autorisierte Wartung.
