# KI-Kennzeichnung der Webseite

**Recherchestand 2026-11-14**

Frage: Gibt es in der EU oder in Deutschland Vorgaben, nach denen die Webseite „KI Perspektiven“ kennzeichnen muss, dass sie mit KI erstellt wurde?

Diese Recherche ist keine Rechtsberatung. Verbindlich auslegen kann die KI-Verordnung letztlich nur der Gerichtshof der Europäischen Union. [Bundesnetzagentur – Transparenzpflichten](https://www.bundesnetzagentur.de/DE/Fachthemen/Digitales/KI/4_Transparenzpflichten/start.html)

## Ergebnis

- **Keine allgemeine Pflicht.** Weder die EU noch Deutschland verlangen einen pauschalen Hinweis, dass eine Webseite mit KI erstellt wurde. Die KI-Verordnung verpflichtet Betreiber nur in festgelegten Fällen zur Offenlegung: bei Deepfakes, bei bestimmten KI-Texten zu Angelegenheiten von öffentlichem Interesse sowie bei Emotionserkennung und biometrischer Kategorisierung. [EU-Kommission – Quick Facts](https://digital-strategy.ec.europa.eu/en/factpages/quick-facts-transparency-rules-ai-systems) · [Bundesnetzagentur – Transparenzpflichten](https://www.bundesnetzagentur.de/DE/Fachthemen/Digitales/KI/4_Transparenzpflichten/start.html)
- **Für die Webseite derzeit freiwillig.** Alle Inhalte werden vor der Veröffentlichung von Marvin Jakob inhaltlich geprüft und verantwortet (Angabe des Betreibers vom 2026-11-14). Damit greift für KI-unterstützte Texte die Ausnahme für menschlich geprüfte Inhalte mit redaktioneller Verantwortung. Die App bindet kein KI-Modell an und bietet keinen Chatbot; die Bilder sind ein Porträtfoto und ein Favicon. [EU-Kommission – FAQ zu Art. 50](https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act) · [KI-Audit-Logik](../app/backend/internal/audit/) · [Frontend-Bilder](../app/frontend/src/assets/)
- **Empfehlung.** Ein kurzer, wahrheitsgemäßer Transparenzhinweis im Footer schafft Vertrauen und passt zum Thema der Webseite. Er darf nicht den Eindruck erwecken, Inhalte seien ungeprüft oder vollständig KI-generiert.

## EU: Art. 50 KI-Verordnung

**Geltung.** Die Transparenzpflichten aus Art. 50 der Verordnung (EU) 2024/1689 gelten seit dem 2. August 2026. Bei Verstößen drohen Unternehmen Bußgelder bis 15 Mio. Euro oder 3 % des weltweiten Jahresumsatzes; für KMU gilt Verhältnismäßigkeit. [EU-Kommission – Quick Facts](https://digital-strategy.ec.europa.eu/en/factpages/quick-facts-transparency-rules-ai-systems) · [Art. 50 KI-VO](https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-50)

**Rolle der Webseite.** Betreiber ist, wer ein KI-System in eigener Verantwortung beruflich nutzt; rein persönliche, nicht berufliche Nutzung ist ausgenommen. Da die Webseite nicht rein privat betrieben wird, ist der Betreiber der Webseite bei KI-Einsatz voraussichtlich Betreiber im Sinne der KI-VO. Anbieterpflichten wie die maschinenlesbare Markierung treffen die Hersteller der genutzten KI-Werkzeuge; Quellcode ist davon ausgenommen. [EU-Kommission – FAQ zu Art. 50](https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act)

**Pflichten im Überblick und Bezug zur Webseite:**

| Fall | Pflicht | Bezug zur Webseite |
| --- | --- | --- |
| KI-System interagiert direkt mit Menschen, z. B. Chatbot (Art. 50 Abs. 1) | Anbieter stellt sicher, dass Menschen über die Interaktion informiert werden, sofern nicht offensichtlich. | Nicht betroffen: kein Chatbot, keine Anbindung an ein KI-Modell. |
| Synthetische Inhalte (Art. 50 Abs. 2) | Anbieter generativer KI markieren Ausgaben maschinenlesbar. Für vor dem 2. August 2026 in Verkehr gebrachte Systeme gilt eine Übergangsfrist bis Dezember 2026. | Pflicht der Werkzeuganbieter, nicht des Webseitenbetreibers. |
| Deepfakes (Art. 50 Abs. 4) | Betreiber legen offen, dass Bild-, Ton- oder Videoinhalte künstlich erzeugt oder manipuliert sind, wenn sie existierenden Personen, Orten oder Ereignissen ähneln und fälschlich echt wirken. | Derzeit keine solchen Inhalte. |
| KI-Texte zu Angelegenheiten von öffentlichem Interesse (Art. 50 Abs. 4) | Betreiber kennzeichnen veröffentlichte KI-Texte, die die Öffentlichkeit informieren sollen, z. B. zu wirtschaftlichen oder wissenschaftlichen Entwicklungen. | Ausnahme greift: menschliche Prüfung und redaktionelle Verantwortung. |

Quellen: [EU-Kommission – Quick Facts](https://digital-strategy.ec.europa.eu/en/factpages/quick-facts-transparency-rules-ai-systems) · [EU-Kommission – FAQ zu Art. 50](https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act) · [Bundesnetzagentur – Transparenzpflichten](https://www.bundesnetzagentur.de/DE/Fachthemen/Digitales/KI/4_Transparenzpflichten/start.html)

**Ausnahme für geprüfte Texte.** Sie verlangt eine inhaltliche Prüfung durch eine fachkundige Person oder redaktionelle Kontrolle mit Befugnis, Texte aus inhaltlichen Gründen freizugeben, zu ändern oder abzulehnen, etwa nach Faktencheck und Quellenprüfung. Reine Rechtschreib- oder Formalprüfungen genügen nicht. Zusätzlich muss eine Person die letztliche rechtliche Verantwortung für die Veröffentlichung tragen. Die Kennzeichnungspflicht lebt wieder auf, sobald ein solcher Text ohne diese Prüfung veröffentlicht wird. [EU-Kommission – FAQ zu Art. 50](https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act) · [EU-Kommission – EU-Icons](https://digital-strategy.ec.europa.eu/en/policies/eu-icons-labelling-ai-generated-content)

**Auslegungshilfen.** Die Kommission hat am 20. Juli 2026 Leitlinien zu Art. 50 veröffentlicht. Der freiwillige Verhaltenskodex zur Transparenz KI-generierter Inhalte erschien im Juni 2026 und wurde von Kommission und KI-Gremium als geeignet bewertet; Unterzeichner können damit die Einhaltung nachweisen. [EU-Kommission – Leitlinien zu Art. 50](https://digital-strategy.ec.europa.eu/en/library/guidelines-transparency-obligations-providers-and-deployers-ai-systems) · [EU-Kommission – Verhaltenskodex](https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content)

**EU-Icons.** Die EU stellt optionale Icons zur Kennzeichnung bereit: ein Basis-Icon, „AI generated“ für vollständig KI-erzeugte Inhalte ohne menschliche redaktionelle Kontrolle und „AI modified“ für teilweise veränderte Inhalte. Die Icons dienen Offenlegungen nach Art. 50 Abs. 4 und sind frei nutzbar; ihre Verwendung durch Nichtunterzeichner signalisiert keine Bindung an den Kodex. Für geprüfte Inhalte wäre insbesondere „AI generated“ irreführend. [EU-Kommission – EU-Icons](https://digital-strategy.ec.europa.eu/en/policies/eu-icons-labelling-ai-generated-content)

## Deutschland

- **Aufsicht.** Das KI-Marktüberwachungs- und Innovationsförderungsgesetz (KI-MIG) gilt seit dem 29. Juli 2026. Die Bundesnetzagentur ist zuständige Marktüberwachungsbehörde für die KI-VO. Eine zusätzliche nationale Kennzeichnungspflicht für Webseiten enthält das Gesetz nach seiner Gliederung nicht; es regelt Zuständigkeiten, Befugnisse, Innovationsförderung und Bußgelder. [KI-MIG, Inhaltsübersicht](https://www.gesetze-im-internet.de/ki-mig/) · [§ 2 KI-MIG](https://www.gesetze-im-internet.de/ki-mig/__2.html) · [IHK Schleswig-Holstein zum KI-MIG](https://www.ihk.de/schleswig-holstein/produktmarken/herausforderungen-krisen/sicherheit/kuenstliche-intelligenz/ki-marktueberwachung-innovationen-7135716)
- **Medienstaatsvertrag.** § 18 Abs. 3 MStV verlangt einen Hinweis bei automatisiert erstellten Inhalten nur für Konten in sozialen Netzwerken, die wie Konten natürlicher Personen wirken. Für journalistisch-redaktionelle Telemedien verlangt § 19 MStV die Einhaltung journalistischer Grundsätze und die sorgfältige Prüfung von Nachrichten, aber keine KI-Kennzeichnung. Dieselbe inhaltliche Prüfung stützt die Ausnahme nach Art. 50 Abs. 4 KI-VO. [§ 18 MStV](https://gesetze.co/SL/MStV/18) · [§ 19 MStV](https://gesetze.co/SL/MStV/19)
- **Pressekodex.** Er bindet nur, wer sich ihm verpflichtet hat. Redaktionen verantworten danach auch KI-generierte Inhalte; eine Kennzeichnungspflicht für KI-Texte hält der Presserat nicht für erforderlich. KI-Bilder sind als Symbolbilder zu kennzeichnen. [Presserat, 18.09.2024](https://www.presserat.de/presse-nachrichten-details/redaktionen-auch-fuer-ki-generierte-inhalte-ethisch-verantwortlich.html)
- **Wettbewerbsrecht.** § 5 UWG verbietet irreführende geschäftliche Handlungen. Ein freiwilliger Hinweis muss deshalb zutreffen, etwa bei der Aussage, Inhalte seien menschlich geprüft. [§ 5 UWG](https://www.gesetze-im-internet.de/uwg_2004/__5.html)

## Wann sich die Bewertung ändert

Eine Kennzeichnung wird nach Art. 50 KI-VO zur Pflicht, wenn die Webseite künftig

- KI-Texte zu Angelegenheiten von öffentlichem Interesse ohne inhaltliche menschliche Prüfung oder ohne redaktionelle Verantwortung veröffentlicht: Kennzeichnung je Text spätestens beim ersten Kontakt, klar erkennbar und barrierefrei;
- KI-Bilder, -Videos oder -Audio verwendet, die realen Personen, Orten oder Ereignissen ähneln und echt wirken: Kennzeichnung als Deepfake;
- einen Chatbot oder eine andere direkte KI-Interaktion anbietet: Hinweis auf die Interaktion mit KI, sofern nicht offensichtlich.

Quellen: [EU-Kommission – FAQ zu Art. 50](https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act) · [EU-Kommission – EU-Icons](https://digital-strategy.ec.europa.eu/en/policies/eu-icons-labelling-ai-generated-content)
