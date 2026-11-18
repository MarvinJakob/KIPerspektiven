import type { Lang } from '../lib/lang';

/** #29: German copy follows the approved mock; English translates the complete article. */
export const vibeCoding: Record<Lang, {
  subtitle: string; updated: string; intro: string[]; story: string; abundance: string; transition: string;
  perspectives: { id: string; name: string; heading: string; body: string; example: string; closing: string }[];
  conclusion: string[]; conclusionTitle: string; conclusionLabel: string;
  home: string; topics: string; breadcrumb: string; introLabel: string;
  harnessDiagram: { alt: string; open: string };
  example: string; storyLabel: string; formLabel: string;
}> = {
  "de": {
    "subtitle": "Willkommen beim Vibe Coding: Dem einfachsten Weg, SLOP zu erzeugen.",
    "updated": "Stand: 16. November 2026",
    "intro": [
      "Du beschreibst, was du möchtest und die KI schreibt den Code. Das macht Spaß. Genial. Du siehst zu, wie ganze Welten vor deinen Augen entstehen, die ungefähr so aussehen wie in deiner Vorstellung. Falls nicht, folgt die nächste hoch durchdachte und präzise Anforderung: „Mach, dass es irgendwie moderner aussieht.“ Und schon hast du die nächsten Token verbrannt und dazu beigetragen, etwas maximal Mittelmäßiges auf den großen Haufen sinnloser Dinge zu generieren.",
      "Zwischen Idee und vorzeigbarem Ergebnis liegt so plötzlich kaum noch Zeit. Ein Prototyp darf improvisiert sein. Für Unternehmen ist genau das sehr verführerisch. Er hat abgerundete Ecken, einen Dark Mode und eine Startseite, die „Deine Produktivität. Neu gedacht.“ verspricht. Was dann passiert, erfahren wir, sobald es jemand produktiv nehmen möchte. Denn eine Anwendung kann beeindruckend aussehen und trotzdem bei der ersten ernst gemeinten Benutzung auseinanderfallen."
    ],
    "story": "Wir öffnen ein Formular und geben unsere Daten ein. Der Speichern-Button zeigt „Erfolgreich gespeichert“. Ob etwas gespeichert wurde, ist eine philosophische Anschlussfrage. „Oh, du möchtest ausschließlich deine eigenen Daten sehen?“ Was für ein überraschend anspruchsvoller Sonderwunsch für eine Anwendung mit Benutzerkonten. Wir melden den Fehler der KI. Sie behebt ihn. Dafür verschwindet die Navigation. Wir lassen die Navigation reparieren. Jetzt ist der Login optional. Nach zwölf Runden läuft die Demo wieder, und wir beschließen, während der Präsentation ausschließlich sehr kontrollierte Mausbewegungen auszuführen. So wächst Software, deren innere Zusammenhänge irgendwann niemand mehr erklären kann. Aber alle erinnern sich noch, dass sie am Anfang wirklich schnell entstanden ist.",
    "abundance": "Während wir noch überlegen, ob die erste Lösung sinnvoll war, hat die KI bereits drei weitere implementiert. Code ist plötzlich im Überfluss vorhanden. Die Verantwortung für das Ergebnis bleibt trotzdem bei uns. Also müssten wir beurteilen, was da entsteht. Aber können wir das überhaupt noch, wenn die KI schneller neue Funktionen schreibt, als wir die bestehenden verstehen? Wer jede erzeugte Zeile persönlich kontrollieren möchte, hat sich gerade einen sehr anstrengenden Job als menschliche Bremse geschaffen.",
    "transition": "Diese fünf Engineering-Perspektiven helfen dabei, diese Verantwortung in den Entwicklungsprozess aufzunehmen.",
    "perspectives": [
      {
        "id": "prompt",
        "name": "Prompt Engineering",
        "heading": "Den Auftrag verständlich formulieren.",
        "body": "Einen guten Prompt zu schreiben bedeutet, eine Anfrage so zu formulieren, dass die KI möglichst klar erkennt, was sie tun soll. Dazu gehören das gewünschte Ergebnis, die Zielgruppe, wichtige Grenzen und das Format. Auch der KI zu erklären, warum, hilft ihr, zwischen mehreren möglichen Lösungen zu wählen.",
        "example": "Statt „Fasse das Dokument zusammen“ könnte der Auftrag lauten: „Fasse das Dokument für unsere Geschäftsführung in fünf kurzen Punkten zusammen. Sie soll entscheiden können, ob sich ein Pilotprojekt lohnt. Nenne deshalb Nutzen, Aufwand und offene Fragen.“",
        "closing": "Ein guter Prompt verbessert die Voraussetzungen, garantiert aber keine richtige Antwort. Trotzdem ist das Prinzip „Shit in → Shit out“ immer noch grundlegend richtig."
      },
      {
        "id": "context",
        "name": "Context Engineering",
        "heading": "Die KI war beim entscheidenden Meeting leider nicht dabei.",
        "body": "Context Engineering beschäftigt sich damit, die jeweils relevanten Informationen bereitzustellen und während der Arbeit aktuell zu halten: passende Codeausschnitte, Schnittstellen, Projektregeln, fachliche Begriffe und frühere Entscheidungen.",
        "example": "Unser Auftrag ist jetzt klar. Nur weiß die KI noch nicht, dass es bereits einen Speicherdienst gibt, warum bestimmte Daten getrennt bleiben müssen und welche technische Altlast seit drei Jahren liebevoll „Übergangslösung“ heißt.",
        "closing": "Entscheidend ist, dass die KI das passende Wissen zum passenden Zeitpunkt findet und widersprüchliche oder veraltete Angaben erkennen kann. Sonst implementiert sie eine ausgesprochen elegante Lösung für ein Unternehmen, das es seit der letzten Umstrukturierung nicht mehr gibt."
      },
      {
        "id": "harness",
        "name": "Harness Engineering",
        "heading": "„Work-Life-Balance“ für die KI.",
        "body": "Jetzt kennt die KI ihren Auftrag und unser Projekt. Damit sie über mehrere Arbeitsschritte verlässlich vorankommt, braucht sie eine technische Arbeitsumgebung. Wir statten unseren Agenten mit Werkzeugen aus, um Schnittstellen zu benutzen und Aktionen auszuführen. Geschickte Administratoren können in einer Organisation eigene Regeln hinzufügen. So können unter anderem Freigaben und Zugriffe verwaltet werden.",
        "example": "Für unser Formular heißt das: Der Agent kann den Fehler nachstellen, eine Änderung vornehmen und anschließend prüfen, ob Speichern, Neuladen, Login und Navigation noch zusammenspielen. Schlägt eine Prüfung fehl, fließt das Ergebnis in den nächsten Versuch ein.",
        "closing": "Im Harness Engineering steuern wir die Fähigkeiten, die unser Agent erhält, um unsere Aufgabe zu erfüllen."
      },
      {
        "id": "specification",
        "name": "Specification Engineering",
        "heading": "„Sind wir schon da?“",
        "body": "Damit unser Agent einschätzen kann, wann er „fertig“ ist, braucht er allerdings einen Maßstab. Wir sollten uns selbst klar darüber werden, was das gewünschte Ergebnis eigentlich ist. Dann machen wir aus unseren Ideen klare, überprüfbare und gepflegte Beschreibungen des gewünschten Verhaltens. „Oder wie wäre das Gleiche in Grün?“ Auch das Design sowie das Look and Feel gehören mit dazu.",
        "example": "Auch KI kann noch keine Gedanken lesen. Soll die Eingabe nur den nächsten Seitenwechsel überleben oder auch einen Neustart? Wer darf sie lesen, ändern oder löschen? Was passiert, wenn die Datenbank nicht erreichbar ist? Es ist Zeit, mal genauer hinzuschauen.",
        "closing": "Und wenn sich die Anforderungen ändern, müssen Beschreibung und Prüfungen mitziehen. Sonst automatisieren wir mit beeindruckender Konsequenz die Wünsche vom vorletzten Donnerstag."
      },
      {
        "id": "product",
        "name": "Product Engineering",
        "heading": "Braucht jemand dieses Formular noch oder kann das weg?",
        "body": "Wir sprechen mit den Menschen, beobachten ihre Abläufe, prüfen Annahmen mit kleinen Experimenten und schauen, ob die fertige Lösung tatsächlich Zeit oder Fehler spart. Product Engineering verbindet das Verständnis für Nutzerprobleme mit Gestaltung, technischer Umsetzung und Lernen im Betrieb.",
        "example": "Was ist eigentlich mit diesem Formular dort? Vielleicht wollen die Menschen überhaupt keine Daten eingeben. Vielleicht wollen sie nur einen Antrag genehmigen und tippen dafür Informationen ab, die im Unternehmen längst vorliegen. Dann wäre doch eine schlankere Lösung viel hilfreicher als unser inzwischen hervorragend getestetes Formular.",
        "closing": "KI kann diese Versuche beschleunigen. Welche Probleme wir lösen und woran wir Erfolg erkennen, müssen wir weiterhin klären. Sonst erzeugen wir schneller zusätzliche Arbeit und geben ihr eine sehr geschmackvolle Benutzeroberfläche."
      }
    ],
    "conclusion": [
      "KI hat das Tempo erhöht. Jetzt wäre ein guter Moment, auch den Anspruch anzuheben. Die fünf Engineering-Perspektiven helfen uns, die gewonnene Geschwindigkeit sinnvoll zu nutzen. Sie geben unserer Arbeit genug Verlässlichkeit, damit wir uns mehr trauen können. Das bietet Raum, um neugierig zu sein, Gewohntes zu hinterfragen und Ideen voranzubringen, die noch keine Erfolgsgarantie mitbringen. Kreativität hält sich schließlich selten an den Projektplan. Es wäre schade, wenn wir dank KI für alles Zeit hätten, außer für einen originellen Gedanken.",
      "Genau darin liegt eine große Chance: Wir können mehr ausprobieren, mutiger gestalten und herausfinden, was Menschen tatsächlich weiterbringt. Dafür braucht es unsere Fantasie, unser Urteilsvermögen und gelegentlich die charmante Unverschämtheit, das bisher Selbstverständliche infrage zu stellen. Wenn wir schon Software in bislang unbekanntem Tempo entwickeln können, dürfen wir uns ruhig etwas einfallen lassen."
    ],
    "conclusionTitle": "KI hat das Tempo erhöht. Jetzt den Anspruch anheben.",
    "conclusionLabel": "Fazit",
    "home": "Start",
    "topics": "Themen",
    "breadcrumb": "Brotkrumen",
    "introLabel": "Einleitung",
    "harnessDiagram": {
      "alt": "Harness-Grafik: Prompt und Dateien gehen in den Agenten. Der Harness ist mit Skill und Tool verbunden und steuert den Bereich aus Context und Model. Dateien landen im Context, Input-Token gehen in das Model, das Output-Token erzeugt. Am Ende steht das Ergebnis.",
      "open": "Harness-Grafik in voller Größe öffnen (neues Fenster)"
    },
    "example": "Im Beispiel",
    "storyLabel": "Stell dir vor",
    "formLabel": "In unserem Formular"
  },
  "en": {
    "subtitle": "Welcome to Vibe Coding: The easiest way to generate SLOP.",
    "updated": "Updated: 16 November 2026",
    "intro": [
      "You describe what you want and AI writes the code. It is fun. Brilliant. You watch entire worlds emerge before your eyes, looking roughly like what you imagined. If they do not, you follow up with another deeply considered, precise requirement: “Make it look a bit more modern somehow.” And just like that, you have burned through another batch of tokens and helped add something utterly mediocre to the great pile of pointless things.",
      "Suddenly, almost no time separates an idea from something you can show. A prototype is allowed to be improvised. For businesses, that is extremely tempting. It has rounded corners, a dark mode and a home page promising “Your productivity. Reimagined.” We discover what happens next when somebody wants to put it into production. An application can look impressive and still fall apart the first time someone seriously tries to use it."
    ],
    "story": "We open a form and enter our details. The Save button says “Successfully saved”. Whether anything was actually saved is a philosophical follow-up question. “Oh, you only want to see your own data?” What a surprisingly demanding special request for an application with user accounts. We report the bug to AI. It fixes it. In return, the navigation disappears. We ask it to repair the navigation. Now logging in is optional. After twelve rounds the demo works again, and we decide to make only very carefully controlled mouse movements during the presentation. This is how software grows until nobody can explain its internal connections anymore. But everyone remembers how quickly it came together at the beginning.",
    "abundance": "While we are still wondering whether the first solution made sense, AI has already implemented three more. Code is suddenly available in abundance. Responsibility for the result still rests with us. So we need to judge what is being created. But can we still do that when AI writes new features faster than we understand the existing ones? Anyone determined to personally inspect every generated line has just created a very exhausting job as a human brake.",
    "transition": "These five engineering perspectives help us incorporate that responsibility into the development process.",
    "perspectives": [
      {
        "id": "prompt",
        "name": "Prompt Engineering",
        "heading": "Make the assignment clear.",
        "body": "Writing a good prompt means formulating a request so that AI understands as clearly as possible what it should do. That includes the desired result, the target audience, important constraints and the format. Explaining why also helps AI choose between several possible solutions.",
        "example": "Instead of “Summarise the document”, the assignment could be: “Summarise the document for our executive team in five short points. They need to decide whether a pilot project is worthwhile. Include the benefits, effort and open questions.”",
        "closing": "A good prompt improves the starting conditions but does not guarantee a correct answer. Nevertheless, the principle “Shit in → Shit out” remains fundamentally true."
      },
      {
        "id": "context",
        "name": "Context Engineering",
        "heading": "AI unfortunately missed the crucial meeting.",
        "body": "Context Engineering is about providing the information relevant to each task and keeping it up to date throughout the work: appropriate code excerpts, interfaces, project rules, business terminology and earlier decisions.",
        "example": "Our assignment is now clear. AI just does not yet know that a storage service already exists, why certain data must stay separate, or which piece of technical debt has affectionately been called a “temporary solution” for the last three years.",
        "closing": "What matters is that AI finds the right knowledge at the right time and can recognise contradictory or outdated information. Otherwise it implements an exceptionally elegant solution for a company that has not existed since the last restructuring."
      },
      {
        "id": "harness",
        "name": "Harness Engineering",
        "heading": "“Work-life balance” for AI.",
        "body": "AI now knows its assignment and our project. To make reliable progress across several steps, it needs a technical working environment. We equip our agent with tools to use interfaces and perform actions. Skilled administrators can add rules specific to an organisation. Among other things, this lets them manage approvals and access permissions.",
        "example": "For our form, this means the agent can reproduce the bug, make a change and then check whether saving, reloading, login and navigation still work together. If a check fails, its result feeds into the next attempt.",
        "closing": "In Harness Engineering we control the capabilities our agent receives to complete our task."
      },
      {
        "id": "specification",
        "name": "Specification Engineering",
        "heading": "“Are we there yet?”",
        "body": "For our agent to judge when it is “finished”, it needs a yardstick. We should first become clear ourselves about what the desired result actually is. Then we turn our ideas into clear, verifiable and maintained descriptions of the desired behaviour. “Or how about the same thing in green?” Design and look and feel belong here too.",
        "example": "Even AI cannot read minds yet. Should the input survive only the next page change, or a restart as well? Who may read, change or delete it? What happens if the database is unavailable? It is time to take a closer look.",
        "closing": "And when requirements change, descriptions and checks must change with them. Otherwise we automate the wishes of the Thursday before last with impressive consistency."
      },
      {
        "id": "product",
        "name": "Product Engineering",
        "heading": "Does anyone still need this form, or can it go?",
        "body": "We talk to people, observe their workflows, test assumptions with small experiments and see whether the finished solution actually saves time or reduces errors. Product Engineering connects an understanding of user problems with design, technical implementation and learning during operation.",
        "example": "What about that form over there? Perhaps people do not want to enter any data at all. Perhaps they only want to approve a request and are typing out information that the organisation already has. A leaner solution would then be far more helpful than our now exceptionally well-tested form.",
        "closing": "AI can accelerate these experiments. We still have to clarify which problems to solve and how to recognise success. Otherwise we create extra work faster and give it a very tasteful user interface."
      }
    ],
    "conclusion": [
      "AI has increased the pace. Now would be a good time to raise our ambitions too. The five engineering perspectives help us use the speed we have gained wisely. They give our work enough reliability to make us more adventurous. This creates room to be curious, question familiar habits and pursue ideas that do not yet come with a guarantee of success. Creativity rarely follows the project plan, after all. It would be a shame if AI gave us time for everything except an original thought.",
      "That is precisely where a great opportunity lies: we can experiment more, design more boldly and find out what actually helps people move forward. This requires our imagination, our judgement and occasionally the charming audacity to challenge what used to be taken for granted. If we can already develop software at a previously unknown pace, we might as well come up with something interesting."
    ],
    "conclusionTitle": "AI has increased the pace. Now raise the ambition.",
    "conclusionLabel": "Conclusion",
    "home": "Home",
    "topics": "Topics",
    "breadcrumb": "Breadcrumbs",
    "introLabel": "Introduction",
    "harnessDiagram": {
      "alt": "Harness diagram: the prompt and files go into the agent. The harness connects to a skill and a tool and drives the area made up of context and model. Files end up in the context, input tokens go into the model, which produces output tokens. The end product is the result.",
      "open": "Open harness diagram in full size (new window)"
    },
    "example": "An example",
    "storyLabel": "Imagine this",
    "formLabel": "In our form"
  }
};
