// Home-Mock: Original-Kopfzeile der App (Header.tsx) nachgebildet, Platzhalter-Hinweise. Keine Speicherung.
(() => {
  const root = document.documentElement;

  // Hell/Dunkel wie ThemeToggle der App: aria-pressed nennt den Zustand, das Symbol zeigt die aktive
  // Darstellung (Sonne hell, Mond dunkel). Die Wahl bleibt im Mock nur im Arbeitsspeicher.
  const SUN = '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>';
  const MOON = '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>';
  const themeButton = document.getElementById('theme-toggle');
  themeButton.addEventListener('click', () => {
    const dark = root.dataset.theme !== 'dark';
    root.dataset.theme = dark ? 'dark' : 'light';
    themeButton.setAttribute('aria-pressed', String(dark));
    themeButton.querySelector('svg').innerHTML = dark ? MOON : SUN;
  });

  // Mobiles Menü und Themenmenü wie in der App: schließen bei Linkwahl, Klick außerhalb,
  // Fokuswechsel aus der Kopfzeile und Esc (offenes Themenmenü zuerst).
  const nav = document.querySelector('.header-inner');
  const toggle = document.getElementById('menu-toggle');
  const menu = document.getElementById('header-menu');
  const topicsButton = document.getElementById('topics-toggle');
  const topics = document.getElementById('topics-menu');
  const topicsRoot = topicsButton.closest('.nav-topics');

  const setMenu = (open) => {
    menu.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  const setTopics = (open) => {
    topics.classList.toggle('is-open', open);
    topicsButton.setAttribute('aria-expanded', String(open));
  };

  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (event) => { if (event.target.closest('a')) { setMenu(false); setTopics(false); } });
  topicsButton.addEventListener('click', (event) => {
    const open = topicsButton.getAttribute('aria-expanded') !== 'true';
    setTopics(open);
    // detail === 0: per Tastatur ausgelöst, dann Fokus auf den ersten Eintrag
    if (open && event.detail === 0) requestAnimationFrame(() => topics.querySelector('a')?.focus());
  });
  document.addEventListener('click', (event) => {
    if (!topicsRoot.contains(event.target)) setTopics(false);
    if (!nav.contains(event.target)) setMenu(false);
  });
  topicsRoot.addEventListener('focusout', (event) => { if (event.relatedTarget && !topicsRoot.contains(event.relatedTarget)) setTopics(false); });
  nav.addEventListener('focusout', (event) => { if (event.relatedTarget && !nav.contains(event.relatedTarget)) setMenu(false); });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (topicsButton.getAttribute('aria-expanded') === 'true') { setTopics(false); topicsButton.focus(); return; }
    if (toggle.getAttribute('aria-expanded') === 'true') { setMenu(false); toggle.focus(); }
  });

  // Platzhalter-Links
  const toast = document.getElementById('toast');
  let timer;
  document.querySelectorAll('[data-placeholder]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      toast.textContent = `${link.dataset.placeholder}: Zielseite ist im Mock noch nicht angebunden.`;
      toast.hidden = false;
      clearTimeout(timer);
      timer = setTimeout(() => { toast.hidden = true; }, 3200);
    });
  });
})();

// KI Readiness · Leitfragen zum Mitmachen: Antwort statt Timer bringt die nächste Frage.
(() => {
  const combo = document.getElementById('combo');
  if (!combo) return;
  const items = [
    ['Strategie und Wirtschaftlichkeit', 'Wissen wir, wofür wir KI einsetzen und ob es sich lohnt?'],
    ['Ressourcenplanung und Kompetenzen', 'Haben wir die Menschen, die Zeit und das Wissen, um mit KI zu arbeiten?'],
    ['Betrieb', 'Läuft unsere KI-Anwendung auch dann zuverlässig, wenn niemand danebensitzt?'],
    ['Governance und Compliance', 'Wissen wir, unter welchen rechtlichen und vertraglichen Bedingungen wir KI einsetzen dürfen?'],
    ['Agenten und Prozesse', 'Ist KI sinnvoll in unsere Arbeitsabläufe eingebunden?'],
    ['Technologie und Infrastruktur', 'Haben wir eine technische Grundlage, auf der wir weitere KI-Anwendungen aufbauen können?'],
    ['Daten und Wissen', 'Findet die KI die Informationen, die sie für ihre Aufgabe braucht, und sind diese verlässlich?'],
    ['Sicherheit und Zuverlässigkeit', 'Können wir nachweisen, dass unsere KI-Anwendung verlässlich und sicher arbeitet?']
  ];
  const feedback = {
    ja: ['Stark. Weiter geht’s.', 'Gut. Das trägt schon.', 'Prima. Nächste Frage.'],
    nein: ['Notiert. Hier liegt ein möglicher nächster Schritt.', 'Kein Problem. Genau dafür ist die Einschätzung da.', 'Ehrlich ist besser als geschönt. Weiter.'],
    skip: ['Übersprungen. Du kannst sie später in Ruhe klären.']
  };
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s) => combo.querySelector(s);
  const ask = $('.combo-ask'), done = $('.combo-done');
  const question = $('.combo-ask .combo-question'), dim = $('.combo-dim'), count = $('.combo-count');
  const progress = $('.combo-progress'), fb = $('.combo-feedback'), restart = $('.combo-restart');
  const summary = $('.combo-summary'), summaryText = $('.combo-summary-text');
  const intro = fb.textContent;
  let index = 0, answers = [];

  progress.innerHTML = items.map((it, i) => `<li><span class="visually-hidden">${it[0]}</span></li>`).join('');
  const bars = [...progress.children];

  const render = () => {
    bars.forEach((li, i) => {
      li.className = answers[i] ? `is-${answers[i]}` : (i === index && ask.hidden === false ? 'is-current' : '');
    });
    if (index < items.length) {
      dim.textContent = items[index][0];
      count.textContent = `Frage ${index + 1} von ${items.length}`;
      question.textContent = items[index][1];
    }
  };

  const finish = () => {
    const ja = answers.filter((a) => a === 'ja').length;
    const offen = items.length - ja;
    ask.hidden = true; done.hidden = false; restart.hidden = false;
    count.textContent = 'Ergebnis'; dim.textContent = 'Alle acht Dimensionen';
    summary.textContent = `${ja} von ${items.length} Leitfragen mit Ja.`;
    summaryText.textContent = offen === 0
      ? 'Beeindruckend. Die vollständige Selbsteinschätzung zeigt, ob das auch im Detail trägt und wo du dich weiter verbessern kannst.'
      : `${offen === 1 ? 'Eine Frage ist' : offen + ' Fragen sind'} noch offen. Das sind deine ersten Ansatzpunkte. Die vollständige Selbsteinschätzung geht in jeder Dimension tiefer und zeigt konkrete nächste Schritte.`;
    fb.textContent = 'Das ist keine Note, sondern eine erste Orientierung.';
    render();
    summary.focus();
  };

  const answer = (value) => {
    // Während des Überblendens keine Antwort annehmen, sonst gilt sie für die noch unsichtbare Frage.
    if (combo.classList.contains('is-switching') || index >= items.length) return;
    answers[index] = value;
    const list = feedback[value];
    fb.textContent = list[index % list.length];
    index += 1;
    if (index >= items.length) { finish(); return; }
    if (reduced) { render(); question.focus(); return; }
    combo.classList.add('is-switching');
    setTimeout(() => { render(); combo.classList.remove('is-switching'); question.focus(); }, 300);
  };

  combo.querySelectorAll('[data-answer]').forEach((b) => b.addEventListener('click', () => answer(b.dataset.answer)));
  restart.addEventListener('click', () => {
    index = 0; answers = [];
    ask.hidden = false; done.hidden = true; restart.hidden = true;
    fb.textContent = intro;
    render(); question.focus();
  });
  render();
})();
