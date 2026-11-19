import { useId, useLayoutEffect, useRef, useState } from 'react';
import { hasEditorialSession, loginEditorial } from '../api/client';
import { editorial, loginErrorKey } from '../lib/editorialLogin';
import { useLang } from '../lib/lang';
import { Icon } from './Icon';

/**
 * Kontosymbol der Kopfzeile mit Anmeldedialog für die Redaktion (Ticket #109).
 *
 * Ohne Redaktionssitzung öffnet das Symbol einen modalen Dialog auf der aktuellen Seite. Er schließt über
 * „Schließen“ oder `Esc`; der Fokus kehrt dann zum Symbol zurück und die Eingaben sind verworfen. Eine
 * erfolgreiche Anmeldung öffnet die Redaktion, eine abgelehnte zeigt eine Meldung und lässt den Dialog offen.
 * Besteht bereits eine Sitzung, führt das Symbol wie zuvor direkt in die Redaktion.
 *
 * Das native `<dialog>` liegt im Top-Layer. So bleibt es von der Glasfläche der Kopfzeile unberührt, der
 * Browser hält den Fokus im Dialog und sperrt die Seite dahinter.
 */
export function AccountLogin({ onOpen }: { onOpen?: () => void }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const emailInput = useRef<HTMLInputElement>(null);
  const checking = useRef(false);
  // Zählt Öffnen und Schließen. Antworten auf eine Anmeldung aus einem bereits geschlossenen Dialog verfallen.
  const visit = useRef(0);
  const id = useId();

  // Layout-Effekt: Der Dialog ist geöffnet und fokussiert, bevor der Browser zeichnet oder weitere Eingaben verarbeitet.
  useLayoutEffect(() => {
    if (!open) return;
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    emailInput.current?.focus();
  }, [open]);

  const activate = async () => {
    if (open || checking.current) return;
    checking.current = true;
    const signedIn = await hasEditorialSession();
    checking.current = false;
    if (signedIn) {
      editorial.open();
      return;
    }
    onOpen?.();
    setOpen(true);
  };

  const close = () => {
    visit.current++;
    // Erst schließen: Solange der Dialog modal offen ist, lässt sich das Symbol dahinter nicht fokussieren.
    if (dialog.current?.open) dialog.current.close();
    setOpen(false);
    setEmail('');
    setPassword('');
    setErrorKey(null);
    setPending(false);
    opener.current?.focus();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    if (!email.trim() || !password) {
      setErrorKey('login.errors.missing');
      return;
    }
    const current = ++visit.current;
    setErrorKey(null);
    setPending(true);
    const status = await loginEditorial({ email, password });
    if (current !== visit.current) return;
    if (status === 200) {
      // Der Dialog bleibt bis zum Seitenwechsel im Zustand „Wird angemeldet …“.
      editorial.open();
      return;
    }
    setPending(false);
    setErrorKey(loginErrorKey(status));
  };

  const error = errorKey ? t(errorKey) : '';
  const errorId = `${id}-fehler`;
  const invalid = { 'aria-invalid': error ? true : undefined, 'aria-describedby': error ? errorId : undefined } as const;

  return (
    <>
      <button
        ref={opener}
        className="icon-btn press"
        type="button"
        aria-haspopup="dialog"
        aria-label={t('nav.account')}
        title={t('nav.account')}
        onClick={() => void activate()}
      >
        <Icon name="user" />
      </button>
      {open && (
        <dialog
          ref={dialog}
          className="login-dialog"
          aria-labelledby={`${id}-titel`}
          aria-describedby={`${id}-hinweis`}
          onCancel={(e) => {
            e.preventDefault();
            close();
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return;
            e.preventDefault();
            e.stopPropagation();
            close();
          }}
        >
          <h2 id={`${id}-titel`}>{t('login.title')}</h2>
          <p className="login-intro" id={`${id}-hinweis`}>
            {t('login.intro')}
          </p>
          <form className="login-form" noValidate onSubmit={(e) => void submit(e)}>
            <div className="contact-field">
              <label htmlFor={`${id}-email`}>{t('login.email')}</label>
              <input
                ref={emailInput}
                id={`${id}-email`}
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                {...invalid}
              />
            </div>
            <div className="contact-field">
              <label htmlFor={`${id}-passwort`}>{t('login.password')}</label>
              <input
                id={`${id}-passwort`}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                {...invalid}
              />
            </div>
            <p className="contact-error login-error" id={errorId} role="alert">
              {error}
            </p>
            <div className="login-actions">
              <button className="btn btn-secondary press" type="button" onClick={close}>
                {t('login.close')}
              </button>
              <button className="btn btn-primary press" type="submit" aria-disabled={pending || undefined}>
                {pending ? t('login.pending') : t('login.submit')}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </>
  );
}
