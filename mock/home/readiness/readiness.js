// Varianten KI-Readiness-Block: Kurzcheck (V1) und Leitfragen-Wechsel (V6).
// Kopfleiste, Hell/Dunkel und Platzhalter-Hinweis kommen unverändert aus ../script.js.
// Nichts wird gespeichert oder übertragen.
(() => {

  // V1 · Kurzcheck mit einer Beispielfrage
  const quick = document.getElementById('quick-check');
  if (quick) {
    const result = quick.querySelector('.quick-result');
    const text = quick.querySelector('#quick-result-text');
    const answers = {
      ja: 'Stark. Diese Frage gehört zum ersten Reifegrad von Strategie und Wirtschaftlichkeit. Sieben weitere Dimensionen zeigen, wo du sonst stehst.',
      nein: 'Damit kennst du schon deinen ersten nächsten Schritt. Die Selbsteinschätzung zeigt dir, was in den anderen sieben Dimensionen ansteht.'
    };
    quick.querySelectorAll('[data-answer]').forEach((button) => {
      button.addEventListener('click', () => {
        quick.querySelectorAll('[data-answer]').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
        text.textContent = answers[button.dataset.answer];
        result.hidden = false;
      });
    });
  }

  // V6 · Leitfragen der acht Dimensionen im Wechsel, pausierbar
  const rotator = document.getElementById('rotator');
  if (rotator) {
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
    const dim = rotator.querySelector('.rotator-dim');
    const question = rotator.querySelector('.rotator-question');
    const count = rotator.querySelector('.rotator-count');
    const pause = rotator.querySelector('#rotator-pause');
    const next = rotator.querySelector('#rotator-next');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let index = 0;
    let timer = null;

    const show = (i) => {
      index = (i + items.length) % items.length;
      const apply = () => {
        dim.textContent = items[index][0];
        question.textContent = items[index][1];
        count.textContent = `${index + 1} / ${items.length}`;
        question.classList.remove('is-fading');
      };
      if (reduced) { apply(); return; }
      question.classList.add('is-fading');
      setTimeout(apply, 350);
    };
    const play = () => { stop(); timer = setInterval(() => show(index + 1), 4500); pause.setAttribute('aria-pressed', 'false'); pause.textContent = 'Pause'; };
    const stop = () => { clearInterval(timer); timer = null; };

    pause.addEventListener('click', () => {
      if (timer) { stop(); pause.setAttribute('aria-pressed', 'true'); pause.textContent = 'Abspielen'; } else { play(); }
    });
    next.addEventListener('click', () => { show(index + 1); });
    rotator.addEventListener('focusin', stop);
    rotator.addEventListener('mouseenter', stop);
    rotator.addEventListener('mouseleave', () => { if (pause.getAttribute('aria-pressed') !== 'true') play(); });

    count.textContent = `1 / ${items.length}`;
    if (!reduced) play(); else { pause.setAttribute('aria-pressed', 'true'); pause.textContent = 'Abspielen'; }
  }
})();
