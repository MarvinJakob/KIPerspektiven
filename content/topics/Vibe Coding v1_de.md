# Vibe Coding

*Stand: 16. November 2026.*

## Willkommen beim Vibe Coding: Dem einfachsten Weg SLOP zu erzeugen

Du beschreibst, was du möchtest und die KI schreibt den Code. Das macht Spaß. Genial. Du siehst zu, wie ganze Welten vor deinen Augen entstehen, die ungefair so aussehen wie in deiner Vorstellung. Falls nicht, folgt die nächste hoch durchdachte und präzise Anforderung: "Mach, dass es irgendwie moderner aussieht.". Und schon hast du die nächsten Token verbrannt und dazu beigetragen etwas maximal mittelmäßiges auf den großen Haufen sinnloser Dinge zu generieren.

Zwischen Idee und vorzeigbarem Ergebnis liegt so plötzlich kaum noch Zeit. Ein Prototyp *darf* improvisiert sein. Für Unternehmen ist genau das sehr verführerisch. Er hat abgerundete Ecken, einen Dark Mode und eine Startseite, die „Deine Produktivität. Neu gedacht.“ verspricht. Was dann passiert, erfahren wir, sobald es jemand produktiv nehmen möchte. Denn eine Anwendung kann beeindruckend aussehen und trotzdem bei der ersten ernst gemeinten Benutzung auseinanderfallen. 

* Wir öffnen ein Formular und geben unsere Daten ein. Der Speichern-Button zeigt „Erfolgreich gespeichert“. Ob etwas gespeichert wurde, ist eine philosophische Anschlussfrage. "Oh du möchtest ausschließlich deine Eigenen Daten sehen?" Was ein überraschend anspruchsvoller Sonderwunsch für eine Anwendung mit Benutzerkonten. Wir melden den Fehler der KI. Sie behebt ihn. Dafür verschwindet die Navigation. Wir lassen die Navigation reparieren. Jetzt ist der Login optional. Nach zwölf Runden läuft die Demo wieder, und wir beschließen, während der Präsentation ausschließlich sehr kontrollierte Mausbewegungen auszuführen. So wächst Software, deren innere Zusammenhänge irgendwann niemand mehr erklären kann. Aber alle erinnern sich noch, dass sie am Anfang wirklich schnell entstanden ist. *

Während wir noch überlegen, ob die erste Lösung sinnvoll war, hat die KI bereits drei weitere implementiert. Code ist plötzlich im Überfluss vorhanden. Die Verantwortung für das Ergebnis bleibt trotzdem bei uns. Also müssten wir beurteilen, was da entsteht. Aber können wir das überhaupt noch, wenn die KI schneller neue Funktionen schreibt, als wir die bestehenden verstehen? Wer jede erzeugte Zeile persönlich kontrollieren möchte, hat sich gerade einen sehr anstrengenden Job als menschliche Bremse geschaffen.

> „Humans should review ideas, not code.“

Diese Fünf Engineering-Perspektiven helfen dabei, diese Verantwortung in dem Entwicklungsprozess aufzunehmen.

### Prompt Entineering - Den Auftrag verständlich formulieren

Eine gute Prompt zu schreiben bedeutet, eine Anfrage so zu formulieren, dass die KI möglichst klar erkennt, was sie tun soll. Dazu gehören das gewünschte Ergebnis, die Zielgruppe, wichtige Grenzen und das Format. Auch der KI zu erklären *Warum* hilft, zwischen mehreren möglichen Lösungen zu wählen.

* Statt „Fasse das Dokument zusammen“ könnte der Auftrag lauten: „Fasse das Dokument für unsere Geschäftsführung in fünf kurzen Punkten zusammen. Sie soll entscheiden können, ob sich ein Pilotprojekt lohnt. Nenne deshalb Nutzen, Aufwand und offene Fragen.“ *

Ein guter Prompt verbessert die Voraussetzungen, garantiert aber keine richtige Antwort. Trotzdem ist das Prinzip: "Shit in -> Shit out" immer noch grundlegend richtig.

### Context Entineering - Die KI war beim entscheidenden Meeting leider nicht dabei

Context Engineering beschäftigt sich damit, die jeweils relevanten Informationen bereitzustellen und während der Arbeit aktuell zu halten: passende Codeausschnitte, Schnittstellen, Projektregeln, fachliche Begriffe und frühere Entscheidungen.

* Unser Auftrag ist jetzt klar. Nur weiß die KI noch nicht, dass es bereits einen Speicherdienst gibt, warum bestimmte Daten getrennt bleiben müssen und welche technische Altlast seit drei Jahren liebevoll „Übergangslösung“ heißt. *

Entscheidend ist, dass die KI das passende Wissen zum passenden Zeitpunkt findet und widersprüchliche oder veraltete Angaben erkennen kann. Sonst implementiert sie eine ausgesprochen elegante Lösung für ein Unternehmen, das es seit der letzten Umstrukturierung nicht mehr gibt.

### Harness Engineering - "work live balance" für die KI

Jetzt kennt die KI ihren Auftrag und unser Projekt. Damit sie über mehrere Arbeitsschritte verlässlich vorankommt, braucht sie eine technische Arbeitsumgebung. Wir statten unseren Agenten mit Werkzeugen aus Schnittstellen zu benutzen und aktionen auszuführen. Geschickte Administratoren können in einer Organisation eigene Regeln hinzufügen. So können unber anderem Freigaben und Zugriffe verwaltet werden.

* Für unser Formular heißt das: Der Agent kann den Fehler nachstellen, eine Änderung vornehmen und anschließend prüfen, ob Speichern, Neuladen, Login und Navigation noch zusammenspielen. Schlägt eine Prüfung fehl, fließt das Ergebnis in den nächsten Versuch ein. *

Im Harness Engineering steuern wir die Fähigkeiten, die unser Agent erhält um unsere Aufgabe zu erfüllen. 

### Specification Engineering - "Sind wir schon da?"

Damit unser Agent einschätzen kann, wann er "fertig" ist, braucht er allerding einen Maßstab. Wir sollten uns selbst klar darüber werden, was das gewünschte Ergebnis eigentlich ist. Dann machen wir aus unseren Ideen klare, überprüfbare und gepflegte Beschreibungen des gewünschten Verhaltens. "Oder wie wäre das Gleiche in Grün?". Auch das Design sowie das Look and Feel gehört mit dazu.

* Auch KI kann noch keine Gedanken lesen. Soll die Eingabe nur den nächsten Seitenwechsel überleben oder auch einen Neustart? Wer darf sie lesen, ändern oder löschen? Was passiert, wenn die Datenbank nicht erreichbar ist? Es ist Zeit mal genauer hinzuschauen *

Und wenn sich die Anforderungen ändern, müssen Beschreibung und Prüfungen mitziehen. Sonst automatisieren wir mit beeindruckender Konsequenz die Wünsche vom vorletzten Donnerstag.

### Product Engineering - Braucht jemand dieses Formular noch oder kann das weg?

Wir sprechen mit den Menschen, beobachten ihre Abläufe, prüfen Annahmen mit kleinen Experimenten und schauen, ob die fertige Lösung tatsächlich Zeit oder Fehler spart. Product Engineering verbindet das Verständnis für Nutzerprobleme mit Gestaltung, technischer Umsetzung und Lernen im Betrieb.

* Was ist eigentlich mit diesem Formular dort? Vielleicht wollen die Menschen überhaupt keine Daten eingeben. Vielleicht wollen sie nur einen Antrag genehmigen und tippen dafür Informationen ab, die im Unternehmen längst vorliegen. Dann wäre doch eine schlankere Lösung viel hilfreicher als unser inzwischen hervorragend getestetes Formular. *

KI kann diese Versuche beschleunigen. Welche Probleme wir lösen und woran wir Erfolg erkennen, müssen wir weiterhin klären. Sonst erzeugen wir schneller zusätzliche Arbeit und geben ihr eine sehr geschmackvolle Benutzeroberfläche.

### Fazit

KI hat das Tempo erhöht. Jetzt wäre ein guter Moment, auch den Anspruch anzuheben. Die fünf Engineering-Perspektiven helfen uns, die gewonnene Geschwindigkeit sinnvoll zu nutzen. Sie geben unserer Arbeit genug Verlässlichkeit, damit wir uns mehr trauen können. Es bietet Raum um neugierig zu sein, Gewohntes zu hinterfragen und Ideen voranzubringen, die noch keine Erfolgsgarantie mitbringen. Kreativität hält sich schließlich selten an den Projektplan. Es wäre schade, wenn wir dank KI für alles Zeit hätten, außer für einen originellen Gedanken.

Genau darin liegt eine große Chance: Wir können mehr ausprobieren, mutiger gestalten und herausfinden, was Menschen tatsächlich weiterbringt. Dafür braucht es unsere Fantasie, unser Urteilsvermögen und gelegentlich die charmante Unverschämtheit, das bisher Selbstverständliche infrage zu stellen. Wenn wir schon Software in bislang unbekanntem Tempo entwickeln können, dürfen wir uns ruhig etwas einfallen lassen.