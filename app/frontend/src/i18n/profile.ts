import type { Lang } from '../lib/lang';

interface ProfileOffer {
  title: string;
  text: string;
  scope: string;
  result: string;
}

interface ProfileContent {
  title: string;
  description: string;
  home: string;
  label: string;
  linkedinUrl: string;
  headline: string;
  headlineAccent: string;
  motto: string;
  focusLabel: string;
  tags: string[];
  discover: string;
  portraitAlt: string;
  role: string;
  caption: string;
  aboutTitle: string;
  about: string[];
  factsLabel: string;
  facts: { title: string; text: string }[];
  contactTitle: string;
  mailLabel: string;
  offersTitle: string;
  scopeLabel: string;
  resultLabel: string;
  offers: ProfileOffer[];
}

export const PROFILE_MAIL = 'mail@marvinjakob.de';

// Inhalte nach content/Persona.md (Ticket #124). Die deutschen Texte sind wortgleich, nur „ - “ ist als
// Gedankenstrich „ – “ gesetzt; profile.test.tsx prüft die Übereinstimmung. Persona.md nennt für den Kontakt nur
// „LinkedIn“ und „Mail“: Das LinkedIn-Ziel stammt aus Ticket #123, die Mailadresse aus dem Impressum.
// Seitentitel und Beschreibung stehen gleichlautend in backend/internal/web/meta.go.
export const profile: Record<Lang, ProfileContent> = {
  de: {
    title: 'Marvin Jakob – Profil',
    description: 'Marvin Jakob, Creative IT Specialist: Technologie verstehen. KI in der Praxis nutzen. Beratung zu KI-Einsatz, Datenstrategie und Agentic AI.',
    home: 'Startseite',
    label: 'Die Person hinter der Perspektive',
    linkedinUrl: 'https://www.linkedin.com/in/marvin-jakob-b5b27726b/?locale=de-DE',
    headline: 'Technologie verstehen.',
    headlineAccent: 'KI in der Praxis nutzen.',
    motto: 'KI verstehen, sinnvoll einsetzen – und dabei ruhig Spaß haben.',
    focusLabel: 'Schwerpunkte',
    tags: ['Projekt Management', 'Business Analyse', 'Software Architektur', 'Software Entwicklung'],
    discover: 'Beratungsangebote entdecken',
    portraitAlt: 'Illustratives Porträt von Marvin Jakob vor einem farbigen Hintergrund',
    role: 'Creative IT Specialist',
    caption: 'Entwickler. Analytiker. Gestalter.',
    aboutTitle: 'Über mich',
    about: [
      'Ich mag Ideen, aus denen etwas wird, das im Alltag wirklich hilft. Seit 2011 bin ich in Softwareprojekten unterwegs: mal in der Entwicklung, mal in der Architektur, mal in der Business Analyse oder Projektleitung. Dabei habe ich gelernt, technische Möglichkeiten und fachliche Bedürfnisse zusammenzudenken. Denn eine Lösung kann technisch spannend sein und trotzdem am eigentlichen Problem vorbeigehen.',
      'Bei KI interessiert mich deshalb beides: Wie funktioniert sie, und was können wir damit sinnvoll anfangen? Dazu gehören auch die Daten, die Abläufe und die Menschen, die später damit arbeiten. Ich tüftle gern, denke auch mal um die Ecke und entwickle Ideen gemeinsam mit anderen weiter. Mit klaren Zielen, passenden Methoden und kleinen, überprüfbaren Schritten lässt sich herausfinden, was hilft. Nicht jedes Problem braucht gleich ein eigenes KI-Modell. Manchmal hilft schon eine gute Frage.',
      'Meine Begeisterung für KI teile ich gern mit Menschen, die neugierig darauf sind. Gemeinsam ausprobieren, Fragen stellen und Erfahrungen austauschen gehört für mich dazu. Man muss nicht alles wissen, um anzufangen. Und wenn dabei ein Aha-Moment und ein Grinsen entstehen: umso besser.',
    ],
    factsLabel: 'Auf einen Blick',
    facts: [
      { title: 'Seit 2011', text: 'Projekterfahrung in der Softwareentwicklung' },
      { title: 'Technologie & Fachlichkeit', text: 'Von der Anforderung bis zum Betrieb' },
      { title: 'Neugier & Austausch', text: 'KI gemeinsam ausprobieren und Erfahrungen teilen' },
    ],
    contactTitle: 'Kontakt',
    mailLabel: 'Mail',
    offersTitle: 'Beratungsangebote',
    scopeLabel: 'Leistungsumfang',
    resultLabel: 'Ergebnis',
    offers: [
      {
        title: 'KI sinnvoll einsetzen – vom Potenzial zum nächsten Schritt',
        text: 'Alle sprechen über KI. Aber wo hilft sie im eigenen Unternehmen wirklich weiter? Ich unterstütze dabei, geeignete Einsatzmöglichkeiten zu finden und realistisch zu bewerten. Ausgangspunkt sind die Aufgaben und Probleme im Alltag – nicht das nächste Werkzeug. Gemeinsam klären wir, wo KI einen Mehrwert bietet und wo einfachere Lösungen, klassische Automatisierung oder bessere Abläufe sinnvoller sind.',
        scope: 'In Gesprächen und Workshops betrachten wir konkrete Prozesse, sammeln Anwendungsfälle und bewerten Nutzen, Aufwand, Datenverfügbarkeit und Risiken. Für die aussichtsreichsten Ideen legen wir fest, woran sich ihr Erfolg messen lässt und wie sie sich mit überschaubarem Aufwand erproben lassen.',
        result: 'Eine priorisierte Auswahl sinnvoller Anwendungsfälle und ein konkreter Plan für die nächsten Schritte – einschließlich einer begründeten Empfehlung, was sich zunächst nicht lohnt.',
      },
      {
        title: 'Datenstrategie – die Grundlage für verlässliche KI',
        text: 'KI kann nur sinnvoll mit Daten arbeiten, die sie finden, verstehen und nutzen darf. Ich unterstütze dabei, die eigenen Daten für KI-Anwendungen und Agenten zugänglich zu machen, ohne bestehende Schutzanforderungen aus dem Blick zu verlieren. Dabei geht es nicht nur um Formate und Schnittstellen, sondern auch um Qualität, Verantwortlichkeiten und klare Zugriffsregeln.',
        scope: 'Ausgehend von einem konkreten Anwendungsfall betrachten wir relevante Datenquellen, Datenqualität und Aktualität. Gemeinsam mit Fachbereichen, IT und den Verantwortlichen für Datenschutz und Informationssicherheit entwickeln wir ein Konzept für Aufbereitung, Bereitstellung und Pflege. Dazu gehören Rollen und Berechtigungen, der Umgang mit sensiblen Informationen und die Nachvollziehbarkeit von Zugriffen. Agenten sollen nur auf die Daten zugreifen können, die sie für ihre Aufgabe benötigen.',
        result: 'Ein umsetzbares Daten- und Berechtigungskonzept mit priorisierten Maßnahmen, klaren Zuständigkeiten und einer Empfehlung für die technische Anbindung an die vorgesehene KI-Lösung.',
      },
      {
        title: 'Agentic AI – Prozesse kontrolliert automatisieren',
        text: 'KI-Agenten können mehr als Antworten formulieren: Sie können Informationen zusammenführen, Werkzeuge nutzen und Arbeitsschritte ausführen. Ich unterstütze beim Aufbau solcher Systeme – dort, wo flexible Entscheidungen gefragt sind und eine feste Regel allein nicht ausreicht. Gemeinsam legen wir fest, was ein Agent selbstständig erledigen darf und wann ein Mensch prüfen oder entscheiden muss.',
        scope: 'Wir grenzen einen geeigneten Prozess ab, definieren Ziele und entwickeln zunächst einen überschaubaren Prototyp. Ich unterstütze bei der Auswahl geeigneter Modelle und Werkzeuge sowie bei der Anbindung an bestehende Systeme. Berechtigungen, menschliche Freigaben, Protokollierung und der Umgang mit Fehlern werden von Anfang an mitgedacht. An realistischen Beispielen prüfen wir Ergebnisqualität, Zuverlässigkeit, Laufzeit und Kosten.',
        result: 'Ein erprobter Prototyp mit dokumentierten Fähigkeiten und Grenzen sowie eine fundierte Entscheidung über den weiteren Ausbau. Für die Überführung in den Betrieb beschreiben wir die nötigen nächsten Schritte, einschließlich Überwachung und Verantwortlichkeiten.',
      },
    ],
  },
  en: {
    title: 'Marvin Jakob – Profile',
    description: 'Marvin Jakob, Creative IT Specialist: understand technology. Use AI in practice. Consulting on AI adoption, data strategy and agentic AI.',
    home: 'Home',
    label: 'The person behind the perspective',
    linkedinUrl: 'https://www.linkedin.com/in/marvin-jakob-b5b27726b/?locale=en-US',
    headline: 'Understand technology.',
    headlineAccent: 'Use AI in practice.',
    motto: 'Understand AI, use it wisely – and feel free to have fun along the way.',
    focusLabel: 'Focus areas',
    tags: ['Project Management', 'Business Analysis', 'Software Architecture', 'Software Development'],
    discover: 'Explore consulting services',
    portraitAlt: 'Illustrated portrait of Marvin Jakob against a colourful background',
    role: 'Creative IT Specialist',
    caption: 'Developer. Analyst. Creator.',
    aboutTitle: 'About me',
    about: [
      'I like ideas that turn into something that genuinely helps in everyday life. I have been working on software projects since 2011: sometimes in development, sometimes in architecture, sometimes in business analysis or project management. Along the way, I have learned to think about technical possibilities and business needs together. After all, a solution can be technically exciting and still miss the actual problem.',
      'That is why I am interested in both sides of AI: How does it work, and what can we sensibly do with it? This also includes the data, the processes and the people who will later work with it. I enjoy tinkering, sometimes think outside the box and like developing ideas further together with others. With clear goals, suitable methods and small, verifiable steps, we can find out what helps. Not every problem needs its own AI model straight away. Sometimes a good question is enough.',
      'I enjoy sharing my enthusiasm for AI with people who are curious about it. Trying things out together, asking questions and exchanging experiences is part of it for me. You don’t have to know everything to get started. And if it leads to an aha moment and a grin along the way: all the better.',
    ],
    factsLabel: 'At a glance',
    facts: [
      { title: 'Since 2011', text: 'Project experience in software development' },
      { title: 'Technology & business', text: 'From requirements to operations' },
      { title: 'Curiosity & exchange', text: 'Trying out AI together and sharing experiences' },
    ],
    contactTitle: 'Contact',
    mailLabel: 'Email',
    offersTitle: 'Consulting services',
    scopeLabel: 'Scope of services',
    resultLabel: 'Outcome',
    offers: [
      {
        title: 'Using AI wisely – from potential to the next step',
        text: 'Everyone is talking about AI. But where does it really help in your own company? I help to find suitable use cases and assess them realistically. The starting point is everyday tasks and problems – not the next tool. Together, we clarify where AI adds value and where simpler solutions, conventional automation or better processes make more sense.',
        scope: 'In conversations and workshops, we look at specific processes, collect use cases and assess benefits, effort, data availability and risks. For the most promising ideas, we define how their success can be measured and how they can be tested with manageable effort.',
        result: 'A prioritised selection of meaningful use cases and a concrete plan for the next steps – including a reasoned recommendation on what is not worthwhile for now.',
      },
      {
        title: 'Data strategy – the foundation for reliable AI',
        text: 'AI can only work meaningfully with data that it can find, understand and is allowed to use. I help to make your own data accessible to AI applications and agents without losing sight of existing protection requirements. This is not only about formats and interfaces, but also about quality, responsibilities and clear access rules.',
        scope: 'Starting from a specific use case, we look at relevant data sources, data quality and timeliness. Together with business units, IT and those responsible for data protection and information security, we develop a concept for preparation, provision and maintenance. This includes roles and permissions, the handling of sensitive information and the traceability of access. Agents should only be able to access the data they need for their task.',
        result: 'An actionable data and permissions concept with prioritised measures, clear responsibilities and a recommendation for the technical connection to the intended AI solution.',
      },
      {
        title: 'Agentic AI – automating processes in a controlled way',
        text: 'AI agents can do more than formulate answers: they can bring information together, use tools and carry out work steps. I support the development of such systems – where flexible decisions are needed and a fixed rule alone is not enough. Together, we define what an agent may do on its own and when a person needs to review or decide.',
        scope: 'We define a suitable process, set goals and first develop a manageable prototype. I support the selection of suitable models and tools and the connection to existing systems. Permissions, human approvals, logging and error handling are considered from the outset. Using realistic examples, we check result quality, reliability, runtime and costs.',
        result: 'A tested prototype with documented capabilities and limitations, and a well-founded decision on further expansion. For the transition to operations, we describe the necessary next steps, including monitoring and responsibilities.',
      },
    ],
  },
};
