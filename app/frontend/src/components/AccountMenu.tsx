import { useEffect, useId, useRef, useState } from 'react';
import { useLang } from '../lib/lang';
import { Icon } from './Icon';

/** Anmeldeseite der Redaktion. Das Backend leitet angemeldete Konten von dort zur Startseite ihrer Rolle weiter. */
export const EDITORIAL_SIGN_IN = '/redaktion/anmelden';

/**
 * Kontosymbol der Kopfzeile mit Kontomenü (Ticket #121, löst den Anmeldedialog aus #109 und #114 ab; seit #130
 * ohne Hinweis und Trennlinie unter dem Eintrag).
 *
 * Das Menü ist eine Disclosure wie das Themenmenü: Button mit `aria-expanded` und eine kleine Fläche direkt am
 * Symbol. Sie nennt den Zweck des Symbols und führt mit einem Link zur Anmeldeseite der Redaktion. Zugangsdaten
 * werden auf öffentlichen Seiten nicht eingegeben, eine Sitzung wird nicht abgefragt.
 *
 * Das Menü schließt über das Symbol, Klick außerhalb, Fokuswechsel aus dem Menü und `Esc` (dann mit Fokus zurück
 * auf das Symbol). `onOpen` meldet der Kopfzeile das Öffnen, damit sie das mobile Hauptmenü schließt; das
 * Themenmenü schließt über seinen eigenen Klick außerhalb.
 */
export function AccountMenu({ onOpen }: { onOpen?: () => void }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const id = useId();
  const menuId = `${id}-menue`;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = (e: React.MouseEvent) => {
    const next = !open;
    setOpen(next);
    if (!next) return;
    onOpen?.();
    // detail === 0: per Tastatur ausgelöst, dann Fokus auf den Eintrag
    if (e.detail === 0) requestAnimationFrame(() => linkRef.current?.focus());
  };

  return (
    <div
      className="account"
      ref={rootRef}
      onBlur={(e) => {
        if (open && e.relatedTarget && !rootRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        className="icon-btn press"
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={t('nav.account')}
        title={t('nav.account')}
        onClick={toggle}
      >
        <Icon name="user" />
      </button>
      {/* Opake Fläche wie das Themenmenü: Glas bleibt der Navigationskapsel vorbehalten. */}
      <div className={`account-menu${open ? ' is-open' : ''}`} id={menuId}>
        <p className="account-label">{t('account.label')}</p>
        {/* Normaler Link statt Router: Die Anmeldeseite gehört zum eigenständigen Redaktionsfrontend. */}
        <a className="account-link" href={EDITORIAL_SIGN_IN} ref={linkRef} onClick={() => setOpen(false)}>
          <span>
            <span className="account-title">{t('account.title')}</span>
            <span className="account-desc">{t('account.desc')}</span>
          </span>
          <Icon name="chevRight" strokeWidth={2} />
        </a>
      </div>
    </div>
  );
}
