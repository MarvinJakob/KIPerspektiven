// Page-specific behaviour. Theme toggle and mobile menu come from ../landing_v03/script.js.

// Contact form does not exist yet: explain instead of navigating.
document.querySelectorAll('[data-placeholder]').forEach(link => {
  link.addEventListener('click', event => {
    event.preventDefault();
    document.getElementById('placeholder-note').textContent = 'Platzhalter im Mock: Das Kontaktformular ist noch nicht angelegt.';
  });
});
