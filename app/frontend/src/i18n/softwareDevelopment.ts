import type { Lang } from '../lib/lang';

/** Pfad der Themenseite Vibe Coding (#6), auf die der Artikel verweist. */
export const VIBE_CODING_PATH = '/themen/vibe-coding';
/** Pfad der Kontaktseite (#4), zu der der Meinungsaufruf führt. */
export const CONTACT_PATH = '/kontakt';

interface Figure {
  /** Beschreibender Alternativtext; beginnt mit dem Namen der Grafik. */
  alt: string;
}

/**
 * Verweis unter „Mehr Themen“. Der Mock nennt Data Analytics und Modelle und Kosten; beide entfallen mit
 * KIPerspektiven#4 (REQ-4-AC5), deshalb stehen hier die verbleibenden Themen Vibe Coding und KI Readiness.
 */

/** Autor und redaktioneller Stand laut Textvorlage (#56); gilt für beide Sprachfassungen. */
export const softwareDevelopmentMeta = { author: 'Marvin Jakob', updated: '2026-11-16' } as const;

export interface SoftwareDevelopmentContent {
  title: string;
  modernTitle: string;
  modern: [string, string];
  relatedLabel: string;
  relatedTitle: string;
  wayTitle: string;
  wayAuthor: string;
  way: string;
  processFigure: Figure;
  teams: string;
  teamsLabel: string;
  releaseFigure: Figure;
  release: string;
  releaseLabel: string;
  opinionTitle: string;
  opinionText: string;
  contact: string;
}

/**
 * Artikel „KI in der Softwareentwicklung“ (#7). Deutsch: Textvorlage `content/topics/Software Development v1_de.md`
 * (Stand 16. November 2026) mit den Rechtschreibkorrekturen aus `mock/software_development/README.md`.
 * Englisch: vollständige Übersetzung. Aufbau und Reihenfolge folgen `mock/software_development/index.html`.
 */
export const softwareDevelopment: Record<Lang, SoftwareDevelopmentContent> = {
  de: {
    title: 'KI in der Software­entwicklung',
    modernTitle: 'Moderne Softwareentwicklung',
    modern: [
      'KI lässt sich besonders wirkungsvoll einsetzen, wenn ihre Ergebnisse gut überprüfbar sind. In der Mathematik können etwa Beweise oder Gegenbeispiele eine Lösung bestätigen oder widerlegen. In der Softwareentwicklung helfen ausführbare Tests, festzustellen, ob eine Implementierung die erwarteten Ergebnisse liefert. Inzwischen ist KI sogar so gut in der Softwareentwicklung geworden, dass wir mit der Beurteilung der Ergebnisse gar nicht mehr hinterherkommen.',
      'KI kann neben dem Schreiben von Code auch Tests erstellen, Fehler suchen und Korrekturen umsetzen. Für Menschen gewinnen klare Anforderungen, geeignete Prüfverfahren und die Gestaltung des gesamten Entwicklungsprozesses an Bedeutung. Je verlässlicher sich Ergebnisse prüfen lassen, desto mehr Arbeitsschritte können Agenten selbstständig übernehmen. Damit verändert sich die Arbeit in der Softwareentwicklung grundlegend.',
    ],
    relatedLabel: 'Weiterlesen',
    relatedTitle: 'Wie du mit Vibe Coding sinnvolle Ergebnisse erzielst, habe ich hier beschrieben',
    wayTitle: '„Das ist der Weg!“',
    wayAuthor: '– Din Djarin',
    way: 'Es führt kein Weg daran vorbei, dass wir klar verstehen müssen, was wir eigentlich wollen und, vielleicht noch wichtiger, warum. Wenn wir das jedoch genau beschreiben können, ist es an der Zeit, die KI auf das Problem loszulassen. Hier möchte ich einen Weg vorstellen, bei dem wir Menschen uns auf die Inhalte konzentrieren und die Fleißarbeit so weit wie möglich der Maschine überlassen.',
    processFigure: {
      alt: 'Entwicklungsprozess: Anforderungen gehen an Team 1 (Analyst), das Szenarien schreibt und verifizierte Tests in den Fidelity Test Backlog legt. Team 2 (Tester) führt die Tests aus und meldet, welche Dinge funktionieren und welche nicht. Team 3 (Fixer) übernimmt mit einem Agenten pro Fall die nicht funktionierenden Dinge und bringt den Code über das Merge Gate (Build, Review, Security, Fidelity) ins gemeinsame Repository.',
    },
    teamsLabel: 'Drei Teams',
    teams: 'Damit möglichst viele Agenten gleichzeitig arbeiten können, habe ich sie in drei Teams aufgeteilt. Das erste Team aus erfahrenen Testanalysten zerlegt die Anforderungen in Szenarien und schreibt Fidelity-Tests. Die erstellte Software soll sich exakt so verhalten, wie es in den Anforderungen beschrieben wurde. Dazu werden in den Fidelity-Tests Abläufe, Sonderfälle und Fehlerbehandlung nach den erstellten Referenzszenarien festgehalten. Diese Art der Tests ist für eine KI leichter überprüfbar. Das ist dann auch die Aufgabe des zweiten Teams aus versierten Testagenten. Diese führen die Tests auf dem bisher erstellten Code einzeln aus und erstellen Feature- und Bug-Tickets. Findet ein Tester eine Abweichung von dem beschriebenen Verhalten, wird diese im Backlog dokumentiert. Auch das gewünschte Verhalten wird als Ticket festgehalten. So füllt sich ein internes Backlog nach und nach als Arbeitsgrundlage für ein drittes Team. Die Fixer holen sich jeweils ein Bug-Ticket und denken so lange darauf herum, bis es gelöst ist. Bevor sich ein Fixer auf einen Code committed, wird dieser noch durch ein Merge Gate geschleust. Alle gelösten Tickets müssen nicht nur das eigentliche Problem lösen, sondern auch Mindeststandards an Code Quality und Security erfüllen.',
    releaseFigure: {
      alt: 'Release Gate: Der Code Stream durchläuft Build (Commits neu bauen), Test (die gesamte Testsuite ausführen) und Final Check (letzte Überprüfungen vor der Freigabe). Danach entsteht der Release Branch, aus dem das fertige Produkt gepackt wird. Erst ganz am Ende wird im Repository veröffentlicht.',
    },
    releaseLabel: 'Release Gate',
    release: 'Die Produktivität unserer Agenten führt zu einer Vielzahl an Commits, die für jedes Release in einem Branch zusammengefasst werden. Bevor wir etwas veröffentlichen, stellen wir in einem finalen Test sicher, dass unser Release auch sauber funktioniert. Der Push in das Repository erfolgt erst ganz am Ende.',
    opinionTitle: 'Würdest du auch so entwickeln?',
    opinionText: 'Teile mir gerne deine Meinung dazu mit.',
    contact: 'Zum Kontaktformular',
  },
  en: {
    title: 'AI in Software Development',
    modernTitle: 'Modern Software Development',
    modern: [
      'AI can be used most effectively when its results are easy to verify. In mathematics, for example, proofs or counterexamples can confirm or refute a solution. In software development, executable tests help to determine whether an implementation delivers the expected results. AI has now become so good at software development that our evaluation of the results can no longer keep up.',
      'AI can do more than write code: it can also create tests, find errors and implement fixes. For people, clear requirements, suitable verification methods and the design of the entire development process are becoming more important. The more reliably results can be verified, the more work steps agents can take on independently. This fundamentally changes the work in software development.',
    ],
    relatedLabel: 'Read on',
    relatedTitle: 'How you can achieve meaningful results with Vibe Coding is what I describe here',
    wayTitle: '“This is the way!”',
    wayAuthor: '– Din Djarin',
    way: 'There is no way around clearly understanding what we actually want and, perhaps more importantly, why. Once we can describe that precisely, it is time to let AI loose on the problem. Here I would like to present an approach in which we humans focus on the content and leave as much of the routine work as possible to the machine.',
    processFigure: {
      alt: 'Development process: Requirements go to Team 1 (Analyst), which writes scenarios and places verified tests in the Fidelity Test Backlog. Team 2 (Tester) runs the tests and reports which things work and which do not. Team 3 (Fixer) takes on the things that do not work, with one agent per case, and brings the code into the shared repository through the Merge Gate (Build, Review, Security, Fidelity).',
    },
    teamsLabel: 'Three teams',
    teams: 'To let as many agents as possible work simultaneously, I have divided them into three teams. The first team, made up of experienced test analysts, breaks the requirements down into scenarios and writes Fidelity Tests. The software we build should behave exactly as described in the requirements. To achieve this, the Fidelity Tests capture flows, edge cases and error handling based on the reference scenarios created. These kinds of tests are easier for an AI to verify. Verifying them is then the job of the second team of skilled test agents. They run the tests on the code written so far, one by one, and create feature and bug tickets. If a tester finds a deviation from the described behaviour, it is documented in the backlog. The desired behaviour is also recorded as a ticket. In this way, an internal backlog gradually fills up as the basis for a third team. The fixers each pick up one bug ticket and chew on it until it is solved. Before a fixer commits to any code, it is passed through a Merge Gate. All resolved tickets must not only solve the actual problem but also meet minimum standards for code quality and security.',
    releaseFigure: {
      alt: 'Release Gate: The code stream passes through Build (rebuild commits), Test (run the entire test suite) and Final Check (last checks before approval). The release branch is then created, from which the finished product is packaged. Publishing to the repository happens only at the very end.',
    },
    releaseLabel: 'Release Gate',
    release: 'The productivity of our agents leads to a large number of commits, which are combined in a branch for each release. Before we publish anything, we make sure in a final test that our release actually works cleanly. The push to the repository only happens at the very end.',
    opinionTitle: 'Would you develop like this too?',
    opinionText: 'Feel free to share your opinion with me.',
    contact: 'Go to the contact form',
  },
};

/** Sichtbarer Artikeltext für die Lesezeit (#56): Titel, Überschriften, Absätze, Weiterlesen-Verweis und Meinungsaufruf. */
export function softwareDevelopmentReadingText(c: SoftwareDevelopmentContent): string[] {
  return [
    c.title, c.modernTitle, ...c.modern, c.relatedLabel, c.relatedTitle, c.wayTitle, c.wayAuthor, c.way,
    c.teams, c.release, c.opinionTitle, c.opinionText,
  ];
}
