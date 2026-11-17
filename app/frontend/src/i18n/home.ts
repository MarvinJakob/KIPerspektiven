import type { Lang } from '../lib/lang';

/**
 * Fließtext mit Auszeichnung: Texte stehen unverändert, `{ code }` wird zu <code>, `{ em }` zu <em>.
 * `{ em }` entspricht der Hervorhebung `*…*` der Textvorlage.
 */
export type RichText = (string | { code: string } | { em: string })[];

/** Pfad der ausführlichen Einordnung zu KI-Einsatzfeldern (Seite AiUses). */
export const AI_USES_PATH = '/ki-einsatzfelder';

/**
 * Themen der Startseite; der Slug ist zugleich Sprungziel und Pfad der Themenseite. Data Analytics und
 * Modelle und Kosten werden seit KIPerspektiven#4 (REQ-4) nicht mehr angeboten.
 */
export type HomeTopicSlug = 'softwareentwicklung';

/** Ein ausführlicher Themenabschnitt: Leitfrage, alle Absätze der Vorlage und Artikel-Verweis. */
export interface HomeTopic {
  slug: HomeTopicSlug;
  title: string;
  /** Kurzzeile im Themenindex unter dem Hero. */
  teaser: string;
  question: string;
  paragraphs: RichText[];
  articleLink: string;
}

interface HomeContent {
  /** Seitentitel und Beschreibung; serverseitig gleichlautend in backend/internal/web/meta.go. */
  title: string;
  description: string;
  hook: string;
  display1: string;
  display2: string;
  lead: [string, string];
  ctaTopics: string;
  ctaNews: string;
  ctaUnderstand: string;
  ctaAudit: string;
  ctaAbout: string;
  indexLabel: string;
  topicsEyebrow: string;
  topicsTitle: [string, string];
  topicsText: [string, string];
  topics: HomeTopic[];
  auditEyebrow: string;
  auditTitle: [string, string];
  auditText: string;
  auditCta: string;
  auditStepsLabel: string;
  auditSteps: [string, string, string];
  auditStepsText: [string, string];
  profileEyebrow: string;
  profileName: string;
  profileText: [string, string];
}

/**
 * Texte der Startseite (Ticket #101). Hero, Leitfragen, Absätze, Hervorhebungen und Artikel-Linktexte stammen
 * wortgleich aus content/Landingpage_v03.md, Stand 10. November 2026; app.test.tsx prüft die Übereinstimmung.
 * Zeichensetzung und Schreibweise der Vorlage bleiben bewusst unverändert. Zwischenüberschriften, Kurzzeilen
 * im Themenindex, KI-Reifegrad-Banner und Profil-Teaser folgen dem Mock mock/landing_v03/.
 */
export const home: Record<Lang, HomeContent> = {
  de: {
    title: 'KI verstehen. Sinnvoll einsetzen.',
    description: 'Praxiswissen für den professionellen Einsatz von KI. Mit klarem Blick auf Nutzen, Grenzen und Verantwortung.',
    hook: 'KI kann viel. Entscheidend ist, wie wir sie einsetzen.',
    display1: 'KI verstehen.',
    display2: 'Sinnvoll einsetzen.',
    lead: ['Praxiswissen für den professionellen Einsatz von KI.', 'Mit klarem Blick auf Nutzen, Grenzen und Verantwortung.'],
    ctaTopics: 'Themen entdecken',
    ctaNews: 'News',
    ctaUnderstand: 'KI verstehen',
    ctaAudit: 'KI Reifegrad einschätzen',
    ctaAbout: 'Über mich',
    indexLabel: 'Direkt zu den Themen',
    topicsEyebrow: 'Aktuell im Fokus',
    topicsTitle: ['Gute Fragen.', 'Neue Perspektiven.'],
    topicsText: ['Den Nutzen sehen. Die Grenzen kennen.', 'Und die richtigen Fragen stellen.'],
    topics: [
      {
        slug: 'softwareentwicklung',
        title: 'Softwareentwicklung',
        teaser: 'Mit Agenten zusammenarbeiten',
        question: 'Wenn KI uns die langweilige Arbeit abnimmt, wird Softwareentwicklung endlich kreativer?',
        paragraphs: [
          ['Weniger Routine, mehr Raum für gute Ideen: Das ist eines der großen Versprechen von KI.'],
          ['Wenn Code erstellen, Tests vorbereiten oder Dokumentation schreiben weniger Zeit kosten, könnten wir uns stärker darauf konzentrieren, Probleme zu verstehen, Lösungswege auszuprobieren und Software besser zu gestalten.'],
          ['Wenn wir jeden Schritt kontrollieren und jeden Vorschlag nacharbeiten müssen, verschiebt sich die Arbeit oft nur.'],
          ['Spannend wird es beim ', { em: 'Schritt vom KI-Assistenten zum KI-Agenten' }, '. Statt uns nur einzelne Vorschläge zu liefern, kann ein Agent zusammenhängende Aufgaben übernehmen'],
          ['Er erschließt bestehenden Code, entwickelt und vergleicht Lösungsansätze, setzt Änderungen um und prüft sie mithilfe von Tests und Code-Reviews.'],
          ['Diese Eigenständigkeit braucht Orientierung und Grenzen.'],
          ['Mit ', { em: 'Skills' }, ' geben wir der KI bewährte Vorgehensweisen mit und machen Fachwissen für die KI nutzbar.'],
          ['Durch ', { em: 'Guardrails' }, ' begrenzen wir ihren Handlungsspielraum um bei kritischen Aktionen die kontrolle zu behalten.'],
          ['Beides hilft uns, Aufgaben gezielt an die KI zu übertragen. Wir legen fest, was sie tun soll und darf, prüfen ihre Ergebnisse und entscheiden, welche Änderungen wir übernehmen.'],
          ['Die Verantwortung für das Ergebnis bleibt bei uns aber wir müssen nicht mehr jeden Arbeitsschritt selbst ausführen.'],
          ['So bleibt mehr Zeit, um die richtigen Herausforderungen zu verstehen und Software zu entwickeln, die echten Mehrwert schafft.'],
          ['Wie sieht diese Zusammenarbeit in der Praxis aus? Im Artikel ', { em: '„KI in der Softwareentwicklung“' }, ' gehen wir genauer darauf ein, welche Aufgaben KI-Agenten übernehmen können, wie Skills sie dabei unterstützen und wie wir mit Guardrails die Kontrolle behalten.'],
        ],
        articleLink: 'Zum Artikel: KI in der Softwareentwicklung',
      },
    ],
    auditEyebrow: 'Der nächste Schritt',
    auditTitle: ['KI-Reifegrad', 'einschätzen.'],
    auditText: 'Wo steht dein Unternehmen beim Einsatz von KI?',
    auditCta: 'Zum KI-Audit',
    auditStepsLabel: 'Drei Reifegrade',
    auditSteps: ['Einfach', 'Strukturiert', 'Intelligent'],
    auditStepsText: ['Den eigenen Stand verstehen.', 'Den nächsten Schritt erkennen.'],
    profileEyebrow: 'Die Perspektive dahinter',
    profileName: 'Marvin Jakob.',
    profileText: ['Softwareentwicklung, Cloud-Architektur und Business Analyse.', 'Ein praxisnaher Blick auf den professionellen Einsatz von KI.'],
  },
  en: {
    title: 'Understand AI. Use it wisely.',
    description: 'Practical knowledge for the professional use of AI. With a clear view of benefits, limits and responsibility.',
    hook: 'AI can do a lot. What matters is how we use it.',
    display1: 'Understand AI.',
    display2: 'Use it wisely.',
    lead: ['Practical knowledge for the professional use of AI.', 'With a clear view of benefits, limits and responsibility.'],
    ctaTopics: 'Explore topics',
    ctaNews: 'News',
    ctaUnderstand: 'Understand AI',
    ctaAudit: 'Assess your AI maturity',
    ctaAbout: 'About me',
    indexLabel: 'Jump to the topics',
    topicsEyebrow: 'Currently in focus',
    topicsTitle: ['Good questions.', 'New perspectives.'],
    topicsText: ['See the benefits. Know the limits.', 'And ask the right questions.'],
    topics: [
      {
        slug: 'softwareentwicklung',
        title: 'Software Development',
        teaser: 'Working together with agents',
        question: 'If AI takes the boring work off our hands, will software development finally become more creative?',
        paragraphs: [
          ['Less routine, more room for good ideas: that is one of the big promises of AI.'],
          ['If writing code, preparing tests or documenting takes less time, we could focus more on understanding problems, trying out solutions and designing better software.'],
          ['If we have to check every step and rework every suggestion, the work often just shifts.'],
          ['It gets exciting with the ', { em: 'step from AI assistant to AI agent' }, '. Instead of only giving us individual suggestions, an agent can take on connected tasks.'],
          ['It explores existing code, develops and compares approaches, implements changes and checks them with tests and code reviews.'],
          ['This autonomy needs direction and limits.'],
          ['With ', { em: 'skills' }, ', we give AI proven ways of working and make expert knowledge usable for AI.'],
          ['With ', { em: 'guardrails' }, ', we limit its room for action so that we stay in control of critical actions.'],
          ['Both help us delegate tasks to AI in a targeted way. We define what it should and may do, check its results and decide which changes we accept.'],
          ['Responsibility for the result stays with us, but we no longer have to carry out every step ourselves.'],
          ['That leaves more time to understand the right challenges and build software that creates real value.'],
          ['What does this collaboration look like in practice? In the article ', { em: '“AI in Software Development”' }, ' we look more closely at which tasks AI agents can take on, how skills support them and how guardrails keep us in control.'],
        ],
        articleLink: 'Read the article: AI in Software Development',
      },
    ],
    auditEyebrow: 'The next step',
    auditTitle: ['Assess your', 'AI maturity.'],
    auditText: 'Where does your company stand in its use of AI?',
    auditCta: 'Go to the AI audit',
    auditStepsLabel: 'Three maturity levels',
    auditSteps: ['Basic', 'Structured', 'Intelligent'],
    auditStepsText: ['Understand where you stand.', 'Recognise the next step.'],
    profileEyebrow: 'The perspective behind it',
    profileName: 'Marvin Jakob.',
    profileText: ['Software development, cloud architecture and business analysis.', 'A practical view of the professional use of AI.'],
  },
};
