import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type MouseEvent } from 'react';
import { useLocation } from 'react-router';
import { prefersReducedMotion } from '../lib/jump';
import { useLang } from '../lib/lang';
import { activeIndex, collectSections, TOC_MEDIA, tocEnabled, type TocSection } from '../lib/toc';

/** Anteil der Fensterhöhe unter der Kopfzeile, ab dem ein Abschnitt als erreicht gilt. */
const READING_LINE = 0.25;
/** Tasten, mit denen der Besucher selbst scrollt; sie heben eine angeklickte Markierung auf. */
const SCROLL_KEYS = new Set(['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' ']);

function useMedia(query: string) {
  const subscribe = useCallback(
    (notify: () => void) => {
      if (typeof matchMedia !== 'function') return () => {};
      const list = matchMedia(query);
      list.addEventListener('change', notify);
      return () => list.removeEventListener('change', notify);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => typeof matchMedia === 'function' && matchMedia(query).matches, () => false);
}

const sameEntries = (a: TocSection[], b: TocSection[]) =>
  a.length === b.length && a.every((s, i) => s.heading === b[i].heading && s.entry.label === b[i].entry.label && s.entry.lang === b[i].entry.lang);

/**
 * Seitliches Inhaltsverzeichnis für die Mobilansicht (Anforderung #98). Eine schmale Leiste am rechten Rand zeigt je
 * Abschnitt eine Marke, die des aktuellen Abschnitts ist länger. Antippen öffnet die Liste der Abschnitte.
 * Über 650 CSS-Pixel, außerhalb des Geltungsbereichs und bei weniger als zwei Abschnitten wird nichts gerendert.
 */
export function MobileToc() {
  const { t } = useLang();
  const { pathname } = useLocation();
  const mobile = useMedia(TOC_MEDIA);
  const enabled = mobile && tocEnabled(pathname);
  const [sections, setSections] = useState<TocSection[]>([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const pinned = useRef<HTMLElement | null>(null);
  const root = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLOListElement>(null);

  // Abschnitte einsammeln, auch wenn Inhalte nachgeladen werden oder die Seite wechselt.
  useEffect(() => {
    setOpen(false);
    const main = document.getElementById('main');
    if (!enabled || !main) {
      setSections([]);
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scan = () => {
      timer = undefined;
      const next = collectSections(main);
      setSections((prev) => (sameEntries(prev, next) ? prev : next));
    };
    scan();
    const observer = new MutationObserver(() => {
      timer ??= setTimeout(scan, 0);
    });
    observer.observe(main, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [enabled, pathname]);

  // Aktuellen Abschnitt beim Scrollen und bei Größenänderungen bestimmen.
  useEffect(() => {
    if (!enabled || sections.length < 2) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const header = document.querySelector('.site-header')?.getBoundingClientRect().bottom ?? 0;
      const target = pinned.current;
      if (target) {
        const r = target.getBoundingClientRect();
        const visible = r.bottom > header && r.top < innerHeight;
        const index = sections.findIndex((s) => s.heading === target);
        if (visible && index >= 0) return setActive(index);
        pinned.current = null;
      }
      const line = header + (innerHeight - header) * READING_LINE;
      const atBottom = innerHeight + scrollY >= document.documentElement.scrollHeight - 2;
      setActive(activeIndex(sections.map((s) => s.heading.getBoundingClientRect().top), line, atBottom));
    };
    const schedule = () => {
      frame ||= requestAnimationFrame(update);
    };
    const release = (e: Event) => {
      if (e instanceof globalThis.KeyboardEvent && !SCROLL_KEYS.has(e.key)) return;
      pinned.current = null;
    };
    update();
    addEventListener('scroll', schedule, { passive: true });
    addEventListener('resize', schedule);
    for (const type of ['wheel', 'touchstart', 'keydown']) addEventListener(type, release, { passive: true, capture: true });
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener('scroll', schedule);
      removeEventListener('resize', schedule);
      for (const type of ['wheel', 'touchstart', 'keydown']) removeEventListener(type, release, { capture: true });
    };
  }, [enabled, sections]);

  // Geöffnete Liste: Fokus auf den ersten Eintrag, Antippen außerhalb schließt sie.
  useEffect(() => {
    if (!open) return;
    list.current?.querySelector('a')?.focus();
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  if (!enabled || sections.length < 2) return null;

  const label = t('toc.label');
  const current = sections[active]?.entry;

  const go = (e: MouseEvent<HTMLAnchorElement>, index: number) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const { heading } = sections[index];
    pinned.current = heading;
    setActive(index);
    setOpen(false);
    heading.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    heading.focus({ preventScroll: true });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || !open) return;
    e.stopPropagation();
    setOpen(false);
    toggle.current?.focus();
  };

  return (
    <nav className="toc" aria-label={label} ref={root} onKeyDown={onKeyDown}>
      <button
        className="toc-toggle"
        type="button"
        ref={toggle}
        aria-expanded={open}
        aria-controls="toc-list"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="toc-rail" aria-hidden="true">
          {sections.map((s, i) => (
            <span key={s.entry.id} className={i === active ? 'is-active' : undefined} />
          ))}
        </span>
        <span className="sr-only">
          {label}
          {current && `, ${t('toc.current')}: ${current.label}`}
        </span>
      </button>
      <div className="toc-panel" id="toc-list" hidden={!open}>
        <p className="toc-title" aria-hidden="true">
          {label}
        </p>
        <ol ref={list}>
          {sections.map(({ entry }, i) => (
            <li key={entry.id}>
              <a href={`#${entry.id}`} lang={entry.lang} aria-current={i === active ? 'location' : undefined} onClick={(e) => go(e, i)}>
                {i === active && <span className="toc-marker" aria-hidden="true" />}
                {entry.label}
              </a>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}
