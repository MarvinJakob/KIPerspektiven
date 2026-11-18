import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ApiError, sendContactMessage } from '../api/client';
import { href, useLang } from '../lib/lang';
import { MESSAGE_MAX, pasteTruncated, remainingChars, showCounter } from '../lib/messageLength';
import { useHead, usePageFocus } from '../lib/page';

// Höchstlängen wie im Backend (service.MaxContact*, service.MaxEmailLength) und in api/openapi.yaml.
const MAX = { name: 200, company: 200, email: 254, message: MESSAGE_MAX } as const;

// Grobe Prüfung vor dem Senden wie beim Beratungsangebot: genau ein @, keine Leerzeichen und ein Punkt in der
// Domain. Maßgeblich ist die strengere Prüfung im Backend; lehnt es die Angaben ab (422), erscheint der Hinweis
// zur E-Mail-Adresse, denn die übrigen Felder prüft das Formular vollständig.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@.]+$/;

type Field = 'name' | 'company' | 'email' | 'message';
type FieldProblem = 'nameEmpty' | 'emailEmpty' | 'emailInvalid' | 'messageEmpty';
type SendProblem = 'failed' | 'tooMany';
type Values = Record<Field, string>;
type Problems = Partial<Record<Field, FieldProblem>>;

const EMPTY: Values = { name: '', company: '', email: '', message: '' };
const ORDER: Field[] = ['name', 'company', 'email', 'message'];

/** Prüft die Eingaben. Das Unternehmen ist optional und daher nie fehlerhaft. */
export function validateContact(v: Values): Problems {
  const p: Problems = {};
  if (!v.name.trim()) p.name = 'nameEmpty';
  const email = v.email.trim();
  if (!email) p.email = 'emailEmpty';
  else if (email.length > MAX.email || !EMAIL_PATTERN.test(email)) p.email = 'emailInvalid';
  if (!v.message.trim()) p.message = 'messageEmpty';
  return p;
}

/**
 * Öffentliche Kontaktseite (Anforderung #4). Name, E-Mail-Adresse und Nachricht sind Pflicht, das Unternehmen
 * ist optional. Fehler stehen am jeweiligen Feld (aria-invalid und aria-describedby), der Fokus springt zum
 * ersten fehlerhaften Feld. Eingaben bleiben bei Fehlern erhalten. Nach erfolgreicher Übermittlung ersetzt
 * eine Bestätigung das Formular und erhält den Fokus. Fehlertexte werden aus Schlüsseln erzeugt, damit sie
 * beim Sprachwechsel in der neuen Sprache erscheinen.
 */
export function Contact() {
  const { lang, t } = useLang();
  const h1 = usePageFocus<HTMLHeadingElement>();
  useHead(t('contact.title'), t('contact.meta'));
  const id = useId();
  const [values, setValues] = useState<Values>(EMPTY);
  const [problems, setProblems] = useState<Problems>({});
  const [sendProblem, setSendProblem] = useState<SendProblem | null>(null);
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const refs = {
    name: useRef<HTMLInputElement>(null),
    company: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    message: useRef<HTMLTextAreaElement>(null),
  };
  const done = useRef<HTMLHeadingElement>(null);
  // Anforderung #77: Hinweis, wenn eingefügter Text an der Grenze gekürzt wurde. Er bleibt stehen, bis der
  // Inhalt anders als durch dieses Einfügen geändert wird. `pasting` markiert die Änderung durch das Einfügen.
  const [truncated, setTruncated] = useState(false);
  const pasting = useRef(false);

  // Nach dem Absenden steht der Fokus auf der Bestätigung, damit auch Screenreader sie sofort vorlesen.
  useEffect(() => {
    if (sentTo) done.current?.focus();
  }, [sentTo]);

  const focusFirst = (p: Problems) => {
    const first = ORDER.find((f) => p[f]);
    if (first) refs[first].current?.focus();
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (sending) return;
    const found = validateContact(values);
    setProblems(found);
    setSendProblem(null);
    if (Object.keys(found).length > 0) {
      focusFirst(found);
      return;
    }
    setSending(true);
    const email = values.email.trim();
    try {
      const company = values.company.trim();
      await sendContactMessage({
        name: values.name.trim(),
        email,
        message: values.message.trim(),
        lang,
        ...(company ? { company } : {}),
      });
      setSentTo(email);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const p: Problems = { email: 'emailInvalid' };
        setProblems(p);
        focusFirst(p);
      } else {
        setSendProblem(err instanceof ApiError && err.status === 429 ? 'tooMany' : 'failed');
      }
    } finally {
      setSending(false);
    }
  }

  const update = (field: Field, value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    if (field === 'message') {
      if (pasting.current) pasting.current = false;
      else setTruncated(false);
    }
    if (problems[field]) setProblems(({ [field]: _removed, ...rest }) => rest);
  };

  const another = () => {
    setValues(EMPTY);
    setTruncated(false);
    setSentTo(null);
    requestAnimationFrame(() => refs.name.current?.focus());
  };

  const fieldProps = (field: Field) => {
    const problem = problems[field];
    return {
      id: `${id}-${field}`,
      name: field,
      value: values[field],
      maxLength: MAX[field],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => update(field, e.target.value),
      'aria-invalid': problem ? true : undefined,
      'aria-describedby': problem ? `${id}-${field}-fehler` : undefined,
    };
  };

  // Vor dem Einfügen prüfen, ob der Text hineinpasst. So erscheint der Hinweis auch, wenn das volle Feld gar
  // nichts mehr annimmt und daher keine Änderung folgt. Die Markierung gilt nur für dieses Einfügen.
  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    setTruncated(pasteTruncated(el.value, el.selectionStart, el.selectionEnd, e.clipboardData.getData('text/plain')));
    pasting.current = true;
    setTimeout(() => (pasting.current = false));
  };

  const counterVisible = showCounter(values.message);
  const messageProps = fieldProps('message');
  const messageDescribedBy =
    [counterVisible && `${id}-message-rest`, truncated && `${id}-message-gekuerzt`, messageProps['aria-describedby']]
      .filter(Boolean)
      .join(' ') || undefined;

  const error = (field: Field) =>
    problems[field] && (
      <p className="contact-error" id={`${id}-${field}-fehler`}>
        {t(`contact.${problems[field]}`)}
      </p>
    );

  return (
    <article className="article contact">
      <h1 className="page-title" tabIndex={-1} ref={h1}>
        {t('contact.title')}
      </h1>
      {sentTo ? (
        <section className="contact-done" aria-labelledby={`${id}-danke`}>
          <h2 className="section-title" id={`${id}-danke`} tabIndex={-1} ref={done}>
            {t('contact.sentTitle')}
          </h2>
          <p>{t('contact.sent', { email: sentTo })}</p>
          <button className="btn btn-secondary press" type="button" onClick={another}>
            {t('contact.another')}
          </button>
        </section>
      ) : (
        <>
          <p className="lead">{t('contact.lead')}</p>
          <form className="contact-form" noValidate onSubmit={submit}>
            <div className="contact-field">
              <label htmlFor={`${id}-name`}>{t('contact.name')}</label>
              <input ref={refs.name} type="text" autoComplete="name" required {...fieldProps('name')} />
              {error('name')}
            </div>
            <div className="contact-field">
              <label htmlFor={`${id}-company`}>{t('contact.company')}</label>
              <input ref={refs.company} type="text" autoComplete="organization" {...fieldProps('company')} />
            </div>
            <div className="contact-field">
              <label htmlFor={`${id}-email`}>{t('contact.email')}</label>
              <input
                ref={refs.email}
                type="email"
                autoComplete="email"
                inputMode="email"
                spellCheck={false}
                required
                {...fieldProps('email')}
              />
              {error('email')}
            </div>
            <div className="contact-field">
              <label htmlFor={`${id}-message`}>{t('contact.message')}</label>
              <textarea
                ref={refs.message}
                rows={8}
                required
                {...messageProps}
                aria-describedby={messageDescribedBy}
                onPaste={onPaste}
              />
              {counterVisible && (
                <p className="contact-counter" id={`${id}-message-rest`}>
                  {t('contact.remaining', { count: remainingChars(values.message) })}
                </p>
              )}
              {/* Live-Region steht dauerhaft im DOM, damit Screenreader den Hinweis beim Einfügen ausgeben. */}
              <p className="contact-truncated" id={`${id}-message-gekuerzt`} role="status">
                {truncated ? t('contact.truncated') : ''}
              </p>
              {error('message')}
            </div>
            <p className="contact-hint">
              {t('contact.hint')} <Link to={href(lang, '/datenschutz')}>{t('contact.privacyLink')}</Link>
            </p>
            <div className="contact-actions">
              <button className="btn btn-primary press" type="submit" aria-disabled={sending || undefined}>
                {sending ? t('contact.sending') : t('contact.submit')}
              </button>
            </div>
            <p className="contact-error contact-status" role="alert">
              {sendProblem ? t(`contact.${sendProblem}`) : ''}
            </p>
          </form>
        </>
      )}
    </article>
  );
}
