// Fachliche Prüfpunkte aus der ausdrücklich beauftragten Textvorlage (16.11.2026).
// Keine Laufzeitabhängigkeit von lokalen content/, mock/ oder res/-Dateien.
export const content = {
  modern: {
    de: [
      /KI lässt sich besonders wirkungsvoll einsetzen, wenn ihre Ergebnisse gut überprüfbar sind/i,
      /Mathematik.*Beweise oder Gegenbeispiele.*bestätigen oder widerlegen/i,
      /ausführbare Tests.*Implementierung.*erwarteten Ergebnisse liefert/i,
      /KI.*so gut.*Softwareentwicklung.*Beurteilung der Ergebnisse.*nicht mehr hinterher/i,
      /KI kann neben dem Schreiben von Code auch Tests erstellen, Fehler suchen und Korrekturen umsetzen/i,
      /Für Menschen gewinnen klare Anforderungen, geeignete Prüfverfahren und die Gestaltung des gesamten Entwicklungsprozesses an Bedeutung/i,
      /Je verlässlicher sich Ergebnisse prüfen lassen, desto mehr Arbeitsschritte können Agenten selbstständig übernehmen/i,
      /Damit verändert sich die Arbeit in der Softwareentwicklung grundlegend?/i,
    ],
    en: [
      /AI.*(?:effective|effectively).*results.*(?:verif|check)/i,
      /mathematics.*proofs or counterexamples.*(?:confirm|validat|support).*(?:refute|disprove|reject)/i,
      /executable tests.*implementation.*expected (?:results|outcomes)/i,
      /AI.*(?:so good|so capable|so proficient).*software development.*(?:evaluat|assess|review|judg).*(?:keep up|fall.*behind)/i,
      /AI.*(?:writ|generat).*code.*(?:creat|writ|generat).*tests.*(?:find|detect).*errors.*(?:implement|make|apply).*fixes/i,
      /(?:people|humans).*clear requirements.*(?:verification|testing|checking).*(?:design|shap).*development process.*(?:important|significan|matter)/i,
      /more reliably.*results.*(?:verif|check).*more.*(?:steps|tasks).*agents.*(?:independently|autonomously|on their own)/i,
      /(?:fundamentally.*chang|chang.*fundamentally).*software development|software development.*(?:fundamentally.*chang|chang.*fundamentally)/i,
    ],
  },
  rationale: {
    de: [
      /klar verstehen müssen, was wir eigentlich wollen und[,\s]*vielleicht noch wichtiger[,\s]*warum/i,
      /Wenn wir das jedoch genau beschreiben können.*KI auf das Problem los.*lassen/i,
      /Menschen.*auf die Inhalte konzentrieren.*(?:fleißarbeit|Fleißarbeit|Routinearbeit).*(?:Mashine|Maschine)/i,
    ],
    en: [
      /(?:clearly understand|clear.*understand).*what we.*want.*(?:more importantly|even more important).*why/i,
      /(?:describe|define|specify).*(?:precisely|accurately|clearly).*AI.*(?:problem|task)/i,
      /(?:people|humans|we).*focus.*(?:content|substance).*machine.*(?:routine|busywork|legwork)|(?:people|humans|we).*focus.*(?:content|substance).*(?:routine|busywork|legwork).*machine/i,
    ],
  },
  teams: {
    de: [
      /möglichst viele Agenten gleichzeitig.*drei Teams/i,
      /erste Team.*Test.?Analysten.*Anforderungen.*S[cz]enarien.*Fidelity.?Tests/i,
      /Software soll sich exakt so verhalten.*Anforderungen beschrieben/i,
      /Fidelity.?Tests.*Abläufe, Sonderfälle und Fehlerbehandlung.*Referenzs[cz]enarien/i,
      /Tests.*für eine KI leichter überprüfbar/i,
      /zweiten Teams.*Test.?Agenten.*Tests.*(?:code|Code).*einzeln.*Feature.? und Bug.?Tickets/i,
      /Abweichung.*beschriebenen [Vv]erhalten.*Backlog dokumentiert/i,
      /gewünschte [Vv]erhalten.*als Ticket festgehalten/i,
      /internes Backlog.*Arbeitsgrundlage.*drittes Team/i,
      /Fixer.*jeweils ein Bug.?Ticket.*bis es gelöst ist/i,
      /(?:committed|committet|Commit).*merge gate/i,
      /gelösten Tickets.*eigentliche Problem lösen.*Mindeststandards.*(?:code quality|Codequalität).*(?:security|Sicherheit)/i,
    ],
    en: [
      /(?:many|multiple).*agents.*(?:simultaneously|in parallel|at the same time).*three teams/i,
      /first team.*test analysts.*requirements.*scenarios.*Fidelity.?Tests/i,
      /software.*(?:exactly|precisely).*(?:behav|requirements)/i,
      /Fidelity.?Tests.*(?:flows|workflows|procedures|sequences).*edge cases.*error handling.*reference scenarios/i,
      /tests.*easier.*AI.*(?:verif|check)/i,
      /second team.*test agents.*tests.*code.*(?:individually|one by one).*feature.*bug tickets/i,
      /(?:deviation|discrepancy).*described behaviou?r.*backlog/i,
      /(?:desired|expected).*behaviou?r.*ticket/i,
      /internal backlog.*(?:basis|foundation).*third team/i,
      /fixers.*(?:one|single|a).*bug ticket.*(?:solved|resolved|fixed)/i,
      /(?:commit.*Merge Gate|Merge Gate.*commit)/i,
      /(?:tickets|fixes|changes).*(?:problem|issue).*(?:minimum|standards).*code quality.*security/i,
    ],
  },
  release: {
    de: [
      /Produktivität.*Agenten.*[Vv]ielzahl.*[Cc]ommits.*[Rr]elease.*[Bb]ranch zusammengefasst/i,
      /Bevor wir etwas veröffentlichen.*finalen Test.*[Rr]elease.*sauber funktioniert/i,
      /[Pp]ush in das Repository.*erst ganz am [Ee]nde/i,
    ],
    en: [
      /(?:productivity|productive).*agents.*(?:many|numerous|large number).*commits.*(?:release.*branch|branch.*release)/i,
      /before.*(?:publish|releas).*final test.*release.*(?:works|functions|working|functioning)/i,
      /push.*repository.*(?:very end|only at the end)/i,
    ],
  },
} as const;
