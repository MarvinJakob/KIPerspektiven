import type { AuditDimensionSummary } from '../api/client';
import type { Lang } from '../lib/lang';

/**
 * Texte der KI-Readiness-Übersicht (Ticket #115). Die deutsche Fassung folgt wörtlich dem Mock readiness_v1,
 * die englische übersetzt ihn. Titel, Leitfrage und Beschreibung der Dimensionen liefert auf Deutsch der
 * Readiness-Katalog des Backends; `dimensions` enthält nur die Übersetzungen, die dem Katalog fehlen.
 */
export interface ReadinessContent {
  hero: { eyebrow: string; title: string; question: string; lead: [string, string]; updated: string };
  introLabel: string;
  intro: string[];
  levels: { eyebrow: string; title: string; intro: string; items: { name: string; text: string }[]; after: string };
  note: { title: string; text: string[] };
  dimensionSection: { eyebrow: string; title: string; intro: string };
  /** Übersichtstexte je Dimensions-Slug, wenn der Katalog die Sprache nicht führt. */
  dimensions: Record<string, { title: string; question: string; description: string[] }>;
  closing: string;
}

export const readiness: Record<Lang, ReadinessContent> = {
  de: {
    hero: {
      eyebrow: 'Selbsteinschätzung',
      title: 'KI Readiness',
      question: 'Sind wir schon ‚KI Ready‘, oder haben wir nur ein KI Abo?',
      lead: ['KI-Readiness einschätzen.', 'Nächste Schritte erkennen.'],
      updated: 'Stand: 19. November 2026',
    },
    introLabel: 'Einführung',
    intro: [
      'Fragen Sie in einem beliebigen Unternehmen, wie es um den Einsatz von KI steht, und Sie hören meist einen dieser Sätze: „Wir sind da ganz gut aufgestellt.“ „Das haben wir im Griff.“ „Darum kümmert sich schon jemand.“ Klingt beruhigend. Die Frage ist nur: Stimmt es auch?',
      'Einen Chatbot zu öffnen und eine Frage zu stellen dauert ungefähr so lange, wie einen Espresso aufzubrühen. Doch KI auszuprobieren und KI professionell einzusetzen, sind zwei verschiedene Dinge. Sobald KI echte Arbeit übernimmt, reicht es nicht, dass ihre Antworten gut klingen. Dann muss jemand wissen, welchen Nutzen sie bringen soll und was sie kostet. Welche Daten sie verwenden darf und welche nicht. Wer eingreift, wenn etwas schiefgeht. Und wie man prüft, ob ihre Ergebnisse stimmen.',
      'Die KI-Readiness-Selbsteinschätzung ist Ihr Faktencheck. Sie gleicht das Bauchgefühl mit dem ab, was sich tatsächlich zeigen lässt, und zwar in allen Bereichen, auf die es beim professionellen KI-Einsatz ankommt. So sehen Sie, was Sie schon sicher beherrschen, wo Sie sich noch auf einzelne Personen oder den Zufall verlassen und wo sich der nächste Schritt lohnt. Das Ergebnis ist keine Note und kein Zertifikat. Es ist eine ehrliche Bestandsaufnahme, die Transparenz über die eigenen Fähigkeiten schafft und Optimierungspotenzial aufdeckt.',
    ],
    levels: {
      eyebrow: 'Fähigkeiten',
      title: 'Glück, Plan oder Lernkurve?',
      intro: 'KI professionell einzusetzen heißt, bestimmte Fähigkeiten aufzubauen: Nutzen bewerten, Daten sauber bereitstellen, Risiken beherrschen, Anwendungen zuverlässig betreiben. Jede Fähigkeit lässt sich in drei Reifegraden erreichen:',
      items: [
        { name: 'Einfach', text: 'Es klappt, aber es hängt an einzelnen Personen und ein wenig am Glück.' },
        { name: 'Strukturiert', text: 'Es klappt verlässlich, weil Vorgehen, Verantwortung und Kennzahlen festgelegt sind, egal wer gerade daran arbeitet.' },
        { name: 'Intelligent', text: 'Es klappt jedes Mal ein bisschen besser, weil Sie aus Fehlern lernen und Ihr Vorgehen gezielt anpassen.' },
      ],
      after: 'Nicht jede Fähigkeit muss die höchste Stufe erreichen. Entscheidend ist, dass sie zu Ihrem Einsatz passt. Und es zählt nur, was sich zeigen lässt: Gute Vorsätze sind noch keine Fähigkeit.',
    },
    note: {
      title: 'Nicht überall auf der höchsten Stufe',
      text: [
        'Es ist völlig in Ordnung, nicht in allen Dimensionen den höchsten Reifegrad zu erreichen. Unterschiedliche Reifegrade über die Dimensionen hinweg sind normal. Welcher Reifegrad sinnvoll ist, hängt vom Einsatz ab: Wer KI für erste Textentwürfe nutzt, braucht keinen ausgefeilten Notfallbetrieb. Wer einen Agenten selbstständig in Kundenprozessen handeln lässt, sollte bei Betrieb, Sicherheit und Governance deutlich weiter sein.',
        'Die Selbsteinschätzung ist keine Bewertung. Sie schafft Transparenz: Wo stehen wir? Wo verlassen wir uns noch auf einzelne Personen? Und wo lohnt sich der nächste Schritt? So erkennen wir Optimierungspotenzial und entscheiden bewusst, welche Dimension wir als Nächstes angehen.',
      ],
    },
    dimensionSection: {
      eyebrow: 'Dimensionen',
      title: 'Wo müssen wir hinschauen?',
      intro: 'Professioneller KI-Einsatz ist mehr als ein gutes Modell. Acht Dimensionen in drei Bereichen decken ab, was bei dem professionellen Einsatz von KI dazugehört.',
    },
    dimensions: {},
    closing: 'Für jede Dimension wählen Sie einen Reifegrad. Am Ende sehen Sie alle acht nebeneinander und erkennen auf einen Blick, wo Sie stark sind und wo sich der nächste Schritt lohnt.',
  },
  en: {
    hero: {
      eyebrow: 'Self-assessment',
      title: 'AI Readiness',
      question: 'Are we ‘AI ready’ yet, or do we just have an AI subscription?',
      lead: ['Assess your AI readiness.', 'Identify your next steps.'],
      updated: 'As of 19 November 2026',
    },
    introLabel: 'Introduction',
    intro: [
      'Ask any company how its use of AI is going and you will usually hear one of these sentences: “We are in pretty good shape.” “We have that under control.” “Someone is already taking care of it.” That sounds reassuring. The only question is: is it true?',
      'Opening a chatbot and asking a question takes about as long as brewing an espresso. But trying out AI and using AI professionally are two different things. As soon as AI takes on real work, it is not enough for its answers to sound good. Then someone has to know what benefit it is supposed to deliver and what it costs. Which data it may use and which it may not. Who steps in when something goes wrong. And how to check whether its results are correct.',
      'The AI readiness self-assessment is your fact check. It compares your gut feeling with what can actually be demonstrated, in every area that matters for the professional use of AI. You see what you already master reliably, where you still depend on individual people or on chance, and where the next step is worthwhile. The result is neither a grade nor a certificate. It is an honest inventory that creates transparency about your own capabilities and reveals potential for improvement.',
    ],
    levels: {
      eyebrow: 'Capabilities',
      title: 'Luck, plan or learning curve?',
      intro: 'Using AI professionally means building certain capabilities: assessing benefits, providing clean data, controlling risks, operating applications reliably. Each capability can be achieved at three maturity levels:',
      items: [
        { name: 'Basic', text: 'It works, but it depends on individual people and a little on luck.' },
        { name: 'Structured', text: 'It works reliably because approach, responsibility and key figures are defined, no matter who is working on it.' },
        { name: 'Intelligent', text: 'It works a little better every time because you learn from mistakes and adapt your approach deliberately.' },
      ],
      after: 'Not every capability has to reach the highest level. What matters is that it fits your use of AI. And only what can be demonstrated counts: good intentions are not yet a capability.',
    },
    note: {
      title: 'Not at the highest level everywhere',
      text: [
        'It is perfectly fine not to reach the highest maturity level in every dimension. Different maturity levels across the dimensions are normal. Which level makes sense depends on the use: if you use AI for first text drafts, you do not need sophisticated emergency operations. If you let an agent act autonomously in customer processes, you should be considerably further along in operations, security and governance.',
        'The self-assessment is not an evaluation. It creates transparency: Where do we stand? Where do we still depend on individual people? And where is the next step worthwhile? This is how we identify potential for improvement and decide deliberately which dimension to tackle next.',
      ],
    },
    dimensionSection: {
      eyebrow: 'Dimensions',
      title: 'Where do we need to look?',
      intro: 'Professional use of AI is more than a good model. Eight dimensions in three areas cover what the professional use of AI involves.',
    },
    dimensions: {
      'strategie-und-wirtschaftlichkeit': {
        title: 'Strategy and economic viability',
        question: 'Do we know what we use AI for and whether it pays off?',
        description: [
          'This is about the concrete benefit: higher quality, shorter processing times, additional profit or lower risks. For each use case we clarify how this benefit arises and which costs and risks it has to be weighed against. A transparent prioritisation decides which initiatives we start, continue or stop. Measurable goals show whether the expected benefit actually materialises.',
        ],
      },
      'ressourcenplanung-und-kompetenzen': {
        title: 'Resource planning and skills',
        question: 'Do we have the people, the time and the knowledge to work with AI?',
        description: [
          'This dimension looks at whether there is enough capacity and whether the right skills are available. Employees must be able to do their tasks with AI. Managers must be able to estimate effort and learning needs. What matters is not the training attended, but whether what was learned is applied to a concrete task. Just as important: knowledge is shared and is retained when someone leaves the team.',
        ],
      },
      betrieb: {
        title: 'Operations',
        question: 'Does our AI application run reliably even when nobody is sitting next to it?',
        description: [
          'As soon as we use AI permanently, it needs looking after. This includes a named operational responsibility, reachable contacts and clear escalation paths, even when several applications and service providers are involved. For outages and faulty actions, there need to be proven ways to stop the process, take it over by hand and resume it. Monitoring and a cost overview that can be attributed make disruptions and consumption peaks visible.',
        ],
      },
      'governance-und-compliance': {
        title: 'Governance and compliance',
        question: 'Do we know under which legal and contractual conditions we may use AI?',
        description: [
          'The starting point is the concrete use case: What purpose does the AI serve, which data does it process and how do we use its results? Depending on the use, this leads to requirements, for example from the EU AI Act, data protection, copyright or the providers’ terms. Existing compliance procedures form the basis and are supplemented by the particularities of AI. If purpose, data or contracts change, we check again.',
        ],
      },
      'agenten-und-prozesse': {
        title: 'Agents and processes',
        question: 'Is AI meaningfully integrated into our workflows?',
        description: [
          'AI can make knowledge available, support decisions and take on tasks, up to autonomous execution by agents. This brings the greatest benefit when we rethink the workflow in the process instead of merely attaching AI to existing steps. The more the AI does on its own and the higher the risk, the more clearly it must be defined when people check, decide or intervene. Fallback procedures keep the process running when the AI fails or delivers unsuitable results.',
        ],
      },
      'technologie-und-infrastruktur': {
        title: 'Technology and infrastructure',
        question: 'Do we have a technical foundation on which we can build further AI applications?',
        description: [
          'This includes models and AI services, platforms, tools, interfaces as well as computing and storage capacity. Whether we use a ready-made solution, adapt it or develop our own depends on the use case. It is important that structure and dependencies are traceable and that other people can repeat the deployment. A practicable exit path prevents us from becoming dependent on a single provider or model.',
        ],
      },
      'daten-und-wissen': {
        title: 'Data and knowledge',
        question: 'Does the AI find the information it needs for its task, and is that information reliable?',
        description: [
          'AI only works as well as the data, documents and expertise it receives. The holdings must cover the intended cases and be correct, complete, up to date and free of contradictions. Origin, version and validity should be traceable so that we can question a result. A permission concept governs who may access what, including copies and search indexes.',
        ],
      },
      'sicherheit-und-zuverlaessigkeit': {
        title: 'Security and reliability',
        question: 'Can we prove that our AI application works reliably and securely?',
        description: [
          'We look at the entire application, including connected data sources and tools. We define which result quality, availability and robustness are required and test them with realistic normal, boundary, error and attack cases. We enforce access rights and limits on actions technically and not only through instructions to the model, for example to protect against injected instructions (prompt injection). In the event of uncertainty, a timeout or an outage, the application switches to a defined safe state.',
        ],
      },
    },
    closing: 'You choose a maturity level for each dimension. At the end you see all eight side by side and recognise at a glance where you are strong and where the next step is worthwhile.',
  },
};

/** Ein Eintrag der Dimensionsliste. `contentLang` ist gesetzt, wenn der Text nicht in der Seitensprache vorliegt. */
export interface OverviewDimension {
  slug: string;
  title: string;
  question: string;
  category: AuditDimensionSummary['category'];
  description: string[];
  contentLang: Lang | undefined;
}

/**
 * Dimensionen der Übersicht in Katalogreihenfolge. Führt der Katalog die Seitensprache nicht, ersetzt die
 * Übersetzung aus `readiness` den Katalogtext; fehlt auch sie, bleibt der Katalogtext mit Sprachkennzeichnung.
 */
export function overviewDimensions(dimensions: readonly AuditDimensionSummary[], lang: Lang): OverviewDimension[] {
  return dimensions.map((d) => {
    const translated = d.lang !== lang ? readiness[lang].dimensions[d.slug] : undefined;
    return translated
      ? { slug: d.slug, category: d.category, ...translated, contentLang: undefined }
      : { slug: d.slug, title: d.title, question: d.summary, category: d.category, description: d.intro, contentLang: d.lang !== lang ? d.lang : undefined };
  });
}

/** Schaltet einen Eintrag der aufklappbaren Liste um; weitere Einträge bleiben, wie sie sind. */
export function toggled(open: ReadonlySet<string>, slug: string): ReadonlySet<string> {
  const next = new Set(open);
  if (!next.delete(slug)) next.add(slug);
  return next;
}
