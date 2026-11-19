import type { Lang } from '../lib/lang';

/** Fließtext mit Auszeichnung: Texte stehen unverändert, `{ code }` wird zu <code>, `{ em }` zu <em>. */
export type RichText = (string | { code: string } | { em: string })[];

/** Pfad der ausführlichen Einordnung zu KI-Einsatzfeldern (Seite AiUses). */
export const AI_USES_PATH = '/ki-einsatzfelder';

/** Themen der Startseite; der Slug ist zugleich Pfad der Themenseite (`/themen/<slug>`). */
export type HomeTopicSlug = 'softwareentwicklung' | 'vibe-coding';

/** Eine nummerierte Themenzeile: Thema, Leitfrage (Linktext) und ein erklärender Satz. */
export interface HomeTopic {
  slug: HomeTopicSlug;
  title: string;
  question: string;
  text: string;
}

/** Eine Leitfrage des Kurzchecks: Dimension der KI Readiness und Frage. */
export interface CheckItem {
  dimension: string;
  question: string;
}

export type CheckAnswer = 'yes' | 'no' | 'skip';

interface HomeContent {
  /** Seitentitel und Beschreibung; serverseitig gleichlautend in backend/internal/web/meta.go. */
  title: string;
  description: string;
  hook: string;
  display1: string;
  display2: string;
  lead: string;
  ctaTopics: string;
  ctaCheck: string;
  topicsEyebrow: string;
  topicsTitle: [string, string];
  topics: HomeTopic[];
  check: {
    eyebrow: string;
    label: string;
    count: (n: number, total: number) => string;
    hint: string;
    answersLabel: string;
    answers: Record<CheckAnswer, string>;
    progressLabel: string;
    progressState: Record<CheckAnswer | 'open', string>;
    intro: string;
    feedback: Record<CheckAnswer, string[]>;
    resultCount: string;
    resultDimension: string;
    result: (yes: number, total: number) => string;
    resultAllYes: string;
    resultOpen: (open: number) => string;
    resultNote: string;
    restart: string;
    start: string;
    items: CheckItem[];
  };
}

/**
 * Texte der Startseite nach content/topics/home v1_de.md (Stand 16.11.2026) und dem Home-Mock .mock/home/ (Ticket #34).
 * Deutsch steht wortgleich wie im Mock. Die Leitfragen entsprechen den Kurzfassungen (`summary`) der Dimensionen
 * in backend/internal/audit/content.json. Englisch übernimmt vorhandene Fassungen (Hero, Leitfrage
 * Softwareentwicklung) und übersetzt die übrigen Mock-Texte. Den Abschnitt „Über mich“ hat #47 entfernt.
 */
export const home: Record<Lang, HomeContent> = {
  de: {
    title: 'KI verstehen. Sinnvoll einsetzen.',
    description: 'Praxiswissen für den professionellen Einsatz von KI. Mit klarem Blick auf Nutzen, Grenzen und Verantwortung.',
    hook: 'KI kann viel. Entscheidend ist, wie wir sie einsetzen.',
    display1: 'KI verstehen.',
    display2: 'Sinnvoll einsetzen.',
    lead: 'Praxiswissen für den professionellen Einsatz von KI. Mit klarem Blick auf Nutzen, Grenzen und Verantwortung.',
    ctaTopics: 'Themen entdecken',
    ctaCheck: 'KI Readiness einschätzen',
    topicsEyebrow: 'Aktuell im Fokus',
    topicsTitle: ['Gute Fragen.', 'Neue Perspektiven.'],
    topics: [
      {
        slug: 'softwareentwicklung',
        title: 'Softwareentwicklung',
        question: 'Wenn KI uns die langweilige Arbeit abnimmt, wird Softwareentwicklung endlich kreativer?',
        text: 'Wie Agenten-Teams mit klaren Tests und Gates Software entwickeln – und wo der Mensch die Verantwortung behält.',
      },
      {
        slug: 'vibe-coding',
        title: 'Vibe Coding',
        question: 'Du beschreibst, was du möchtest, und die KI schreibt den Code. Was kann da schon schiefgehen?',
        text: 'Warum „Mach es irgendwie moderner“ selten reicht – und wie aus Vibe Coding sinnvolle Ergebnisse werden.',
      },
    ],
    check: {
      eyebrow: 'KI Readiness · Kurzcheck',
      label: 'KI Readiness Kurzcheck',
      count: (n, total) => `Frage ${n} von ${total}`,
      hint: 'Antworte nach dem, was sich tatsächlich zeigen lässt.',
      answersLabel: 'Antwort auf die Leitfrage',
      answers: { yes: 'Ja', no: 'Nein', skip: 'Überspringen' },
      progressLabel: 'Fortschritt',
      progressState: { yes: 'Ja', no: 'Nein', skip: 'übersprungen', open: 'offen' },
      intro: 'Acht Leitfragen, eine pro Dimension. Wie viele kannst du mit Ja beantworten?',
      feedback: {
        yes: ['Stark. Weiter geht’s.', 'Gut. Das trägt schon.', 'Prima. Nächste Frage.'],
        no: ['Notiert. Hier liegt ein möglicher nächster Schritt.', 'Kein Problem. Genau dafür ist die Einschätzung da.', 'Ehrlich ist besser als geschönt. Weiter.'],
        skip: ['Übersprungen. Du kannst sie später in Ruhe klären.'],
      },
      resultCount: 'Ergebnis',
      resultDimension: 'Alle acht Dimensionen',
      result: (yes, total) => `${yes} von ${total} Leitfragen mit Ja.`,
      resultAllYes: 'Beeindruckend. Die vollständige Selbsteinschätzung zeigt, ob das auch im Detail trägt und wo du dich weiter verbessern kannst.',
      resultOpen: (open) =>
        `${open === 1 ? 'Eine Frage ist' : `${open} Fragen sind`} noch offen. Das sind deine ersten Ansatzpunkte. Die vollständige Selbsteinschätzung geht in jeder Dimension tiefer und zeigt konkrete nächste Schritte.`,
      resultNote: 'Das ist keine Note, sondern eine erste Orientierung.',
      restart: 'Noch einmal',
      start: 'Selbsteinschätzung starten',
      items: [
        { dimension: 'Strategie und Wirtschaftlichkeit', question: 'Wissen wir, wofür wir KI einsetzen und ob es sich lohnt?' },
        { dimension: 'Ressourcenplanung und Kompetenzen', question: 'Haben wir die Menschen, die Zeit und das Wissen, um mit KI zu arbeiten?' },
        { dimension: 'Betrieb', question: 'Läuft unsere KI-Anwendung auch dann zuverlässig, wenn niemand danebensitzt?' },
        { dimension: 'Governance und Compliance', question: 'Wissen wir, unter welchen rechtlichen und vertraglichen Bedingungen wir KI einsetzen dürfen?' },
        { dimension: 'Agenten und Prozesse', question: 'Ist KI sinnvoll in unsere Arbeitsabläufe eingebunden?' },
        { dimension: 'Technologie und Infrastruktur', question: 'Haben wir eine technische Grundlage, auf der wir weitere KI-Anwendungen aufbauen können?' },
        { dimension: 'Daten und Wissen', question: 'Findet die KI die Informationen, die sie für ihre Aufgabe braucht, und sind diese verlässlich?' },
        { dimension: 'Sicherheit und Zuverlässigkeit', question: 'Können wir nachweisen, dass unsere KI-Anwendung verlässlich und sicher arbeitet?' },
      ],
    },
  },
  en: {
    title: 'Understand AI. Use it wisely.',
    description: 'Practical knowledge for the professional use of AI. With a clear view of benefits, limits and responsibility.',
    hook: 'AI can do a lot. What matters is how we use it.',
    display1: 'Understand AI.',
    display2: 'Use it wisely.',
    lead: 'Practical knowledge for the professional use of AI. With a clear view of benefits, limits and responsibility.',
    ctaTopics: 'Explore topics',
    ctaCheck: 'Assess your AI readiness',
    topicsEyebrow: 'Currently in focus',
    topicsTitle: ['Good questions.', 'New perspectives.'],
    topics: [
      {
        slug: 'softwareentwicklung',
        title: 'Software Development',
        question: 'If AI takes the boring work off our hands, will software development finally become more creative?',
        text: 'How agent teams build software with clear tests and gates – and where people keep the responsibility.',
      },
      {
        slug: 'vibe-coding',
        title: 'Vibe Coding',
        question: 'You describe what you want and AI writes the code. What could possibly go wrong?',
        text: 'Why “Just make it look more modern somehow” rarely works – and how vibe coding leads to meaningful results.',
      },
    ],
    check: {
      eyebrow: 'AI Readiness · Quick check',
      label: 'AI Readiness quick check',
      count: (n, total) => `Question ${n} of ${total}`,
      hint: 'Answer based on what you can actually demonstrate.',
      answersLabel: 'Answer to the guiding question',
      answers: { yes: 'Yes', no: 'No', skip: 'Skip' },
      progressLabel: 'Progress',
      progressState: { yes: 'yes', no: 'no', skip: 'skipped', open: 'open' },
      intro: 'Eight guiding questions, one per dimension. How many can you answer with yes?',
      feedback: {
        yes: ['Strong. On we go.', 'Good. That already carries weight.', 'Great. Next question.'],
        no: ['Noted. This is a possible next step.', 'No problem. That is exactly what the assessment is for.', 'Honest beats polished. Next.'],
        skip: ['Skipped. You can clarify it later at your own pace.'],
      },
      resultCount: 'Result',
      resultDimension: 'All eight dimensions',
      result: (yes, total) => `${yes} of ${total} guiding questions answered Yes.`,
      resultAllYes: 'Impressive. The full self-assessment shows whether this holds up in detail and where you can improve further.',
      resultOpen: (open) =>
        `${open === 1 ? 'One question is' : `${open} questions are`} still open. These are your first starting points. The full self-assessment goes deeper in every dimension and shows concrete next steps.`,
      resultNote: 'This is not a grade, but a first orientation.',
      restart: 'Try again',
      start: 'Start self-assessment',
      items: [
        { dimension: 'Strategy and economic viability', question: 'Do we know what we use AI for and whether it pays off?' },
        { dimension: 'Resource planning and skills', question: 'Do we have the people, the time and the knowledge to work with AI?' },
        { dimension: 'Operations', question: 'Does our AI application run reliably even when nobody is watching it?' },
        { dimension: 'Governance and compliance', question: 'Do we know the legal and contractual conditions under which we may use AI?' },
        { dimension: 'Agents and processes', question: 'Is AI meaningfully integrated into our workflows?' },
        { dimension: 'Technology and infrastructure', question: 'Do we have a technical foundation on which we can build further AI applications?' },
        { dimension: 'Data and knowledge', question: 'Does the AI find the information it needs for its task, and is that information reliable?' },
        { dimension: 'Security and reliability', question: 'Can we demonstrate that our AI application works reliably and securely?' },
      ],
    },
  },
};
