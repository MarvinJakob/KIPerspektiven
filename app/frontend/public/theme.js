// Setzt die Darstellung vor dem ersten Zeichnen, damit keine andere Darstellung aufblitzt (Tickets #20, #53, #104).
// Gespeicherte Wahl, sonst Systemeinstellung (prefers-color-scheme), ohne Auskunft hell.
// Als eigene Datei, weil die CSP Inline-Skripte verbietet. Gleiche Regel wie src/lib/theme.ts.
(function () {
  var theme = null;
  try {
    theme = localStorage.getItem('ki-perspektiven.theme');
  } catch (e) {
    /* privat oder blockiert */
  }
  if (theme !== 'light' && theme !== 'dark') {
    var dark = false;
    try {
      dark = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch (e) {
      /* ohne Auskunft hell */
    }
    theme = dark ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', theme);
})();
