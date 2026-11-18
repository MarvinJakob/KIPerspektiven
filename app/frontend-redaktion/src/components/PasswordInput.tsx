import { useEffect, useState, type InputHTMLAttributes, type KeyboardEvent, type PointerEvent } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { id: string };

/**
 * Passwortfeld, das nur während des Gedrückthaltens des Icons Klartext zeigt (Ticket #6).
 * Maus, Touch und Leertaste zeigen das Passwort; Loslassen, Abbruch, Verlassen des Icons,
 * Fokusverlust von Icon oder Fenster maskieren es sofort. Ein Klick schaltet nichts dauerhaft um.
 */
export function PasswordInput({ id, ...input }: Props) {
  const [revealed, setRevealed] = useState(false);
  const hide = () => setRevealed(false);

  useEffect(() => {
    if (!revealed) return;
    const onVisibility = () => document.hidden && setRevealed(false);
    window.addEventListener('blur', hide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', hide);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [revealed]);

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    // Fokus bleibt im Eingabefeld; ohne implizite Touch-Erfassung meldet der Browser das Verlassen des Icons.
    e.preventDefault();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setRevealed(true);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== ' ') return;
    e.preventDefault();
    if (!e.repeat) setRevealed(true);
  };
  const onKeyUp = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== ' ') return;
    e.preventDefault();
    hide();
  };

  return (
    <div className="password-input">
      <input
        {...input}
        id={id}
        type={revealed ? 'text' : 'password'}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />
      <button
        type="button"
        className="icon-btn password-reveal"
        aria-label="Passwort anzeigen, solange gedrückt"
        aria-controls={id}
        title="Gedrückt halten, um das Passwort anzuzeigen"
        onPointerDown={onPointerDown}
        onPointerUp={hide}
        onPointerCancel={hide}
        onPointerLeave={hide}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onBlur={hide}
        onContextMenu={(e) => e.preventDefault()}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
          <circle cx="12" cy="12" r="3" />
          {!revealed && <path d="M4 20 20 4" />}
        </svg>
      </button>
    </div>
  );
}
