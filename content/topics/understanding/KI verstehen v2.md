# KI verstehen

*Stand: 15. November 2026.*

## Wie funktioniert KI?

Künstliche Intelligenz erkennt Muster in Daten und nutzt sie, um Aufgaben zu bearbeiten. Dieser Artikel erklärt vor allem Sprachmodelle: die KI hinter vielen Chat-Assistenten und Agenten, die Texte schreiben, Fragen beantworten oder beim Programmieren helfen.

Ein Sprachmodell lernt während des Trainings aus vielen Beispielen, wie Sprache aufgebaut ist und welche Zusammenhänge häufig vorkommen. Bei einer Anfrage wird der Text in kleine Bausteine zerlegt, sogenannte **Tokens**. Ein Token kann ein Wort, ein Wortteil oder ein Satzzeichen sein. Das Modell berechnet, welche Bausteine zur Eingabe passen, und erzeugt seine Antwort Schritt für Schritt. Dabei berücksichtigt es die bereitgestellten Informationen, den **Kontext**. [Grundlagen: Google](https://developers.google.com/machine-learning/crash-course/llm)

So entstehen oft hilfreiche Antworten. Eine überzeugende Formulierung ist aber noch kein Beleg für Richtigkeit. KI kann Zusammenhänge falsch deuten und Angaben erfinden. Deshalb brauchen wir klare Aufgaben, passende Informationen und eine Möglichkeit, das Ergebnis zu prüfen.

## Vom Sprachmodell zum Agenten

Ein KI-Agent kann eine Aufgabe über mehrere Schritte bearbeiten. Er nutzt ein Sprachmodell, um nächste Schritte auszuwählen, und Werkzeuge, um beispielsweise Dateien zu lesen, Informationen zu suchen oder Code auszuführen. Die Ergebnisse fließen in den nächsten Schritt ein. Dieser Kreislauf läuft weiter, bis die Aufgabe abgeschlossen ist oder eine Grenze erreicht wird. [Grundlagen: Anthropic](https://www.anthropic.com/research/building-effective-agents)

Die Grafik „Agents“ zeigt, welche Bestandteile dabei zusammenspielen:

![Aufbau eines KI-Agenten: Prompt und Dateien liefern die Eingaben. Das Modell verarbeitet Tokens und Kontext. Das Harness verbindet es mit Skills und Tools. Rechts steht das Ergebnis.](../ressources/grafiken/Agent.png)

Links stehen **Prompt** und **Files**: der Auftrag und die Dateien mit benötigten Informationen. Deren relevante Inhalte werden dem Modell als Kontext bereitgestellt. Im unteren Bereich verarbeitet das **Model** die Eingabe, also die Input-Tokens, und erzeugt die Output-Tokens für seine Antwort.

Oben verbindet das **Harness** das Modell mit **Skills** und **Tools**. Ein Skill beschreibt ein wiederverwendbares Vorgehen, etwa wie ein Bericht aufgebaut werden soll. Ein Tool ist ein ausführbares Werkzeug, etwa eine Dateisuche. Das Harness organisiert die Zusammenarbeit. Rechts steht das **Result**, also das Ergebnis: beispielsweise ein Text, eine Auswertung oder eine bearbeitete Datei.

Als Bild kann man sagen: **Das Modell ist das Gehirn; das Harness gibt ihm Augen und Hände.** Das Modell schlägt Schritte vor, die umgebende Software ermöglicht und kontrolliert ihre Ausführung. Auch ein leistungsfähiges Modell braucht deshalb eine passende Arbeitsumgebung. [Hintergrund zum Harness: Perplexity](https://www.perplexity.ai/de/hub/blog/harness-engineering)

## Fünf Disziplinen für gute KI-Ergebnisse

Die folgenden Disziplinen beleuchten unterschiedliche Fragen der Zusammenarbeit mit KI. Sie ergänzen sich und überschneiden sich teilweise.

### Prompt Engineering: Den Auftrag verständlich formulieren

Prompt Engineering bedeutet, eine Anfrage so zu formulieren, dass die KI möglichst klar erkennt, was sie tun soll. Dazu gehören das gewünschte Ergebnis, die Zielgruppe, wichtige Grenzen und das Format. Erklären Sie auch das **Warum**: Der Zweck hilft, zwischen mehreren möglichen Lösungen zu wählen.

Statt „Fasse das Dokument zusammen“ könnte der Auftrag lauten: „Fasse das Dokument für unsere Geschäftsführung in fünf kurzen Punkten zusammen. Sie soll entscheiden können, ob sich ein Pilotprojekt lohnt. Nenne deshalb Nutzen, Aufwand und offene Fragen.“

Der Gedanke „Shit in, shit out“ lässt sich einfach übersetzen: Unklare oder falsche Eingaben erschweren ein gutes Ergebnis. Ein guter Prompt verbessert die Voraussetzungen, garantiert aber keine richtige Antwort.

### Context Engineering: Die passenden Informationen bereitstellen

Context Engineering sorgt dafür, dass das Modell die Informationen bekommt, die es für den aktuellen Schritt benötigt. Dazu gehören der Auftrag, bisherige Nachrichten, relevante Dateien, Werkzeugergebnisse und übergeordnete Anweisungen. Ein **System Prompt** gibt grundlegende Regeln vor. Eine Projektdatei wie `AGENTS.md` kann zusätzliche Arbeitsregeln liefern, sofern das verwendete Werkzeug sie lädt.

Das **Kontextfenster** ist der begrenzte Platz für diese Informationen. Nicht jede Datei im Projekt ist automatisch darin enthalten. Bei langen Aufgaben können ältere Inhalte gekürzt oder zusammengefasst werden; dabei können wichtige Details verloren gehen. Fragen Sie deshalb: Hat die KI die richtigen Informationen erhalten? Sind die entscheidenden Vorgaben noch enthalten? Hilfreich ist ein übersichtlicher, aktueller Kontext mit den tatsächlich benötigten Angaben. [Grundlagen: Anthropic](https://www.anthropic.com/research/effective-context-engineering-for-ai-agents)

### Harness Engineering: Die Arbeitsumgebung gestalten

Harness Engineering gestaltet die Software rund um das Modell. Sie stellt Projektinformationen bereit, verbindet Werkzeuge und steuert den Arbeitsablauf. Dazu gehört auch, welche Dateien der Agent verändern darf, wann eine Freigabe nötig ist und wie Ergebnisse geprüft werden. Das Harness setzt damit technisch um, was in der Grafik die Verbindung zwischen Modell, Kontext, Skills und Tools bildet. [Grundlagen: Perplexity](https://www.perplexity.ai/de/hub/blog/harness-engineering)

**Hooks** sind automatische Aktionen an festgelegten Stellen im Ablauf. Beispielsweise kann nach einer Dateiänderung die Formatierung geprüft oder vor einem Werkzeugaufruf eine Regel kontrolliert werden. Welche Hooks verfügbar sind, hängt vom eingesetzten System ab. [Beispiel: Hooks in Claude Code](https://code.claude.com/docs/en/hooks-guide)

### Specification Engineering: Das gewünschte Ergebnis beschreiben

Specification Engineering macht aus einer Idee eine überprüfbare Beschreibung. Anforderungen und Dokumente halten fest, was entstehen soll. Ein Design zeigt Aufbau und Bedienung. Ein Plan beschreibt die Schritte zur Umsetzung. Akzeptanzkriterien legen fest, woran wir erkennen, dass die Aufgabe erfüllt ist.

Bei „Baue eine Terminbuchung“ bleiben viele Fragen offen: Wer darf buchen? Wie werden freie Zeiten ermittelt? Was passiert bei einer Absage? Lassen Sie den Agenten sein Verständnis, offene Fragen und den geplanten Ablauf darstellen. So können Sie Missverständnisse vor der Umsetzung erkennen. Die Beschreibung wird im Austausch präziser und dient anschließend als Grundlage für die Prüfung.

### Product Engineering: Den Nutzen für Menschen erreichen

Product Engineering verbindet die technische Umsetzung mit der Frage, für wen ein Produkt entsteht und welches Problem es lösen soll. Ein Produkt ist hilfreich, wenn Menschen damit ihr Ziel besser erreichen. Viele Funktionen allein sagen darüber wenig aus.

Bei einer Terminbuchung könnte das Ziel sein, die Abstimmung per E-Mail zu verkürzen. Prüfen Sie mit den vorgesehenen Nutzern, ob sie einen passenden Termin finden und buchen können. Beobachten Sie anschließend, ob der Abstimmungsaufwand tatsächlich sinkt. Diese Erkenntnisse bestimmen, was als Nächstes verbessert werden sollte.

## Zwei Leitsätze für die Zusammenarbeit mit KI

> „Vibe Coding ist der einfachste Weg, Slop zu erzeugen.“

Der Satz ist bewusst zugespitzt. Mit Vibe Coding ist hier gemeint, Software auf Zuruf erzeugen zu lassen und weitgehend ungeprüft zu übernehmen. „Slop“ bezeichnet Ergebnisse, die schnell entstehen, aber wenig Nutzen haben oder mangelhaft sind. So können viele Funktionen entstehen, ohne dass klar ist, ob sie gebraucht werden oder zuverlässig funktionieren.

Für einen ersten Entwurf kann freies Ausprobieren hilfreich sein. Für ein dauerhaft genutztes Produkt braucht es zusätzlich ein klares Ziel, passende Informationen, verständliche Anforderungen und überprüfte Ergebnisse. Die fünf Disziplinen helfen dabei, aus einer schnellen Idee eine brauchbare Lösung zu machen.

> „Humans should review ideas, not code.“

Sinngemäß: Menschen sollten vor allem die Ideen und Entscheidungen prüfen, die hinter einer Umsetzung stehen. Löst das Produkt das richtige Problem? Sind die Anforderungen sinnvoll? Passt der vorgeschlagene Ablauf zu den Nutzern? Solche Fragen früh zu klären verhindert, dass eine falsche Idee aufwendig umgesetzt wird.

Als vollständiger Verzicht auf Code-Reviews wäre der Satz zu weitgehend. Automatisierte Tests und KI-Reviews können Prüfungen übernehmen, übersehen aber ebenfalls Fehler. Je nach Tragweite bleibt eine menschliche Prüfung des Codes nötig. Der Leitsatz lenkt den Blick auf eine zusätzliche Verantwortung: Neben der Umsetzung müssen auch Zweck, Annahmen und Auswirkungen beurteilt werden.
