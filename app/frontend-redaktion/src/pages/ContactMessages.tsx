import { useContactMessages, type ContactMessage } from '../api/contactMessages';
import { Loading, Page } from '../components/Layout';

const LANG_NAMES: Record<string, string> = { de: 'Deutsch', en: 'Englisch' };

// Uhrzeiten in deutscher Zeit, wie in der Statistik und bei den Beratungsanfragen.
const ZONE = 'Europe/Berlin';
const dateFormat = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: ZONE });
const timeFormat = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: ZONE });
const formatAt = (iso: string) => `${dateFormat.format(new Date(iso))}, ${timeFormat.format(new Date(iso))} Uhr`;

// Die Adresse stammt von Besuchern: kodieren, damit z. B. „?cc=…“ im Mailprogramm keine weiteren Kopfzeilen setzt (RFC 6068).
const mailtoHref = (email: string) => `mailto:${encodeURIComponent(email).replace(/%40/g, '@')}`;

/**
 * Nachrichtenbereich (Anforderung #4): Nachrichten der öffentlichen Kontaktseite, neueste zuerst, mit Name,
 * Unternehmen, E-Mail-Adresse und Nachrichtentext. Für die Rollen editor und admin; das Backend prüft Sitzung
 * und Rolle bei Seite und API. Die Texte stammen von Besuchern und werden nur als Text dargestellt.
 */
export function ContactMessagesPage() {
  const { data: items, isPending, isError, refetch } = useContactMessages();

  return (
    <Page title="Nachrichten">
      <p className="lead">
        Nachrichten von der Kontaktseite der Webseite, neueste zuerst. Antworten Sie per E-Mail an die angegebene
        Adresse.
      </p>
      {isPending && <Loading />}
      {isError && (
        <p className="form-error" role="alert">
          Die Nachrichten konnten nicht geladen werden.{' '}
          <button className="btn btn-secondary btn-small press" type="button" onClick={() => refetch()}>
            Erneut versuchen
          </button>
        </p>
      )}
      {items &&
        (items.length === 0 ? (
          <p className="empty-state card">Es liegen keine Nachrichten vor.</p>
        ) : (
          <ol className="message-list" aria-label="Nachrichten, neueste zuerst">
            {items.map((m) => (
              <MessageItem key={m.id} message={m} />
            ))}
          </ol>
        ))}
    </Page>
  );
}

function MessageItem({ message: m }: { message: ContactMessage }) {
  return (
    <li className="card message">
      <article aria-labelledby={`nachricht-${m.id}`}>
        <header className="message-head">
          <h2 className="card-title" id={`nachricht-${m.id}`}>
            {m.name}
          </h2>
          <time className="message-time" dateTime={m.receivedAt}>
            {formatAt(m.receivedAt)}
          </time>
        </header>
        <dl className="message-meta">
          <div>
            <dt>Unternehmen</dt>
            <dd>{m.company || 'Nicht angegeben'}</dd>
          </div>
          <div>
            <dt>E-Mail-Adresse</dt>
            <dd>
              <a href={mailtoHref(m.email)}>{m.email}</a>
            </dd>
          </div>
          <div>
            <dt>Sprache</dt>
            <dd>{LANG_NAMES[m.lang] ?? m.lang}</dd>
          </div>
        </dl>
        <p className="message-text">{m.message}</p>
      </article>
    </li>
  );
}
