import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ApiError, requestConsultation } from '../api/client';
import { href, useLang } from '../lib/lang';

/** Höchstlänge einer E-Mail-Adresse wie im Backend (service.MaxEmailLength). */
const MAX_EMAIL_LENGTH = 254;

// Grobe Prüfung vor dem Senden: genau ein @, keine Leerzeichen und ein Punkt in der Domain. Maßgeblich ist die
// strengere Prüfung im Backend; lehnt es eine Adresse ab (422), erscheint derselbe Hinweis.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@.]+$/;

/** Feldfehler stehen am Eingabefeld, Übermittlungsfehler unter dem Button. */
type Problem = 'empty' | 'invalid' | 'failed' | 'tooMany';
const FIELD_PROBLEMS: Problem[] = ['empty', 'invalid'];

const problemOf = (err: unknown): Problem => {
  if (err instanceof ApiError && err.status === 422) return 'invalid';
  if (err instanceof ApiError && err.status === 429) return 'tooMany';
  return 'failed'; // Serverfehler, Netzfehler, abgelehnte Herkunft
};

/**
 * Angebot eines kostenlosen Beratungsgesprächs auf der Auswertung (Ticket #136). Einziges Feld ist die
 * E-Mail-Adresse; übertragen wird erst beim Absenden, und zwar nur die Adresse und die Sprache der Seite,
 * nicht das Ergebnis. Die Bestätigung ersetzt das Formular erst nach erfolgreicher Übermittlung. Scheitert sie,
 * bleibt die Eingabe erhalten und lässt sich erneut senden. Die Auswertung darüber bleibt in jedem Fall
 * vollständig nutzbar.
 */
export function ConsultationOffer() {
  const { lang, t } = useLang();
  const id = useId();
  const [email, setEmail] = useState('');
  const [problem, setProblem] = useState<Problem | null>(null);
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const done = useRef<HTMLHeadingElement>(null);

  // Nach dem Absenden steht der Fokus auf der Bestätigung, damit auch Screenreader sie sofort vorlesen.
  useEffect(() => {
    if (sentTo) done.current?.focus();
  }, [sentTo]);

  const titleId = `${id}-titel`;
  const hintId = `${id}-hinweis`;
  const errorId = `${id}-fehler`;
  const fieldProblem = problem && FIELD_PROBLEMS.includes(problem) ? problem : null;
  const sendProblem = problem && !fieldProblem ? problem : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (sending) return;
    const value = email.trim();
    const invalid = !value ? 'empty' : value.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(value) ? 'invalid' : null;
    if (invalid) {
      setProblem(invalid);
      input.current?.focus();
      return;
    }
    setProblem(null);
    setSending(true);
    try {
      await requestConsultation({ email: value, lang });
      setSentTo(value);
    } catch (err) {
      const p = problemOf(err);
      setProblem(p);
      if (p === 'invalid') input.current?.focus();
    } finally {
      setSending(false);
    }
  }

  if (sentTo) {
    return (
      <section className="section consult" aria-labelledby={titleId}>
        <h2 className="section-title" id={titleId} tabIndex={-1} ref={done}>
          {t('assess.consult.sentTitle')}
        </h2>
        <p className="consult-text">{t('assess.consult.sent', { email: sentTo })}</p>
      </section>
    );
  }

  return (
    <section className="section consult" aria-labelledby={titleId}>
      <h2 className="section-title" id={titleId}>
        {t('assess.consult.title')}
      </h2>
      <p className="consult-text">{t('assess.consult.text')}</p>
      <form className="consult-form" noValidate onSubmit={submit}>
        <label htmlFor={`${id}-email`}>{t('assess.consult.label')}</label>
        <input
          ref={input}
          id={`${id}-email`}
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
          required
          maxLength={MAX_EMAIL_LENGTH}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (fieldProblem) setProblem(null);
          }}
          aria-invalid={fieldProblem ? true : undefined}
          aria-describedby={fieldProblem ? `${errorId} ${hintId}` : hintId}
        />
        {fieldProblem && (
          <p className="consult-error" id={errorId}>
            {t(`assess.consult.${fieldProblem}`)}
          </p>
        )}
        <p className="consult-hint" id={hintId}>
          {t('assess.consult.hint')} <Link to={href(lang, '/datenschutz')}>{t('assess.consult.privacyLink')}</Link>
        </p>
        <div className="consult-actions">
          <button className="btn btn-primary press" type="submit" aria-disabled={sending || undefined}>
            {sending ? t('assess.consult.sending') : t('assess.consult.submit')}
          </button>
        </div>
        <p className="consult-error consult-status" role="alert">
          {sendProblem ? t(`assess.consult.${sendProblem}`) : ''}
        </p>
      </form>
    </section>
  );
}
