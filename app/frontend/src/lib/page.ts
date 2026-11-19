import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import type { Lang } from './lang';

const SITE = 'KI Perspektiven';

/**
 * Titel im Browser-Tab (Anforderung #108): Websitename, genau ein Leerzeichen, Seitenname. Ohne Seitennamen,
 * etwa auf der Startseite, bleibt der Websitename. Gleichlautend in backend/internal/web/meta.go (tabTitle).
 */
export function tabTitle(name?: string): string {
  const trimmed = name?.trim();
  return trimmed ? `${SITE} ${trimmed}` : SITE;
}

// Der Titel aus dem HTML des Backends gilt für die zuerst geöffnete Adresse, bis die Anwendung die Seite wechselt.
let firstHeadKey: string | null = null;
let serverTitleValid = true;

/**
 * Setzt Titel und Beschreibung im <head> (Erstaufruf: Backend). `name` ist der Seitenname, `''` steht für die
 * Startseite. Solange ein Inhalt lädt, ist `name` `undefined`: Nach einem Seiten- oder Sprachwechsel zeigt der
 * Tab dann nur den Websitenamen (REQ-108-AC2). Beim Direktaufruf bleibt der Titel des Backends stehen, damit er
 * während des Ladens nicht wechselt (REQ-108-AC3).
 */
export function useHead(name: string | undefined, description?: string) {
  const { key } = useLocation();
  // Layout-Effekt: läuft vor den Effekten, mit denen eine eingebettete Fehlerseite ihren eigenen Titel setzt.
  useLayoutEffect(() => {
    if (firstHeadKey === null) firstHeadKey = key;
    else if (key !== firstHeadKey) serverTitleValid = false;
    if (name === undefined && !serverTitleValid) document.title = SITE;
  }, [name, key]);
  useEffect(() => {
    if (name === undefined) return;
    document.title = tabTitle(name);
    if (description !== undefined) {
      let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'description';
        document.head.appendChild(meta);
      }
      meta.content = description;
    }
  }, [name, description, key]);
}

/** Schaltet die Fokusverwaltung beim Seitenwechsel ab, z. B. beim Sprachwechsel. */
export interface NavState {
  keepPosition?: boolean;
}

let firstKey: string | null = null;
const focusedKeys = new Set<string>();

/**
 * Nach jedem Seitenwechsel springt der Fokus auf die H1 (Design.md, Abschnitt 8).
 * Beim ersten Aufruf und beim Sprachwechsel bleibt der Fokus, wo er ist.
 */
export function usePageFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const location = useLocation();
  useEffect(() => {
    if (firstKey === null) firstKey = location.key;
    if (location.key === firstKey || focusedKeys.has(location.key)) return;
    if ((location.state as NavState | null)?.keepPosition) return;
    if (!ref.current) return;
    ref.current.focus({ preventScroll: true });
    focusedKeys.add(location.key);
    // Ohne Abhängigkeitsliste: Die H1 kann erst nach dem Laden der API-Daten erscheinen.
    // Der Location-Key verhindert erneuten Fokus bei späteren Änderungen auf derselben Seite.
  });
  return ref;
}

const dateFormats = new Map<Lang, Intl.DateTimeFormat>();

export function formatDate(iso: string, lang: Lang): string {
  let f = dateFormats.get(lang);
  if (!f) {
    f = new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Europe/Berlin',
    });
    dateFormats.set(lang, f);
  }
  return f.format(new Date(iso));
}
