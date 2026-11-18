import { useEffect, useRef, useState } from 'react';
import { ApiError, can, useMe } from '../api/client';
import { useContactMessages, useDeleteContactMessage, type ContactMessage } from '../api/contactMessages';
import { Loading, Page } from '../components/Layout';

interface Notice {
  kind: 'ok' | 'error';
  text: string;
}

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
 * Unternehmen, E-Mail-Adresse und Nachrichtentext. Für die Rollen marketing und admin (#64), die eine Nachricht
 * auf Wunsch auch sofort löschen (#90); das Backend prüft Sitzung, Rolle und CSRF-Token bei Seite und API.
 * Unabhängig davon löscht die Anwendung jede Nachricht spätestens sechs Monate nach Eingang.
 * Die Texte stammen von Besuchern und werden nur als Text dargestellt.
 */
export function ContactMessagesPage() {
  const { data: items, isPending, isError, refetch } = useContactMessages();
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);

  // Wie bei den Beratungsanfragen: Die Meldung erhält den Fokus, damit er nach dem Löschen nicht ins Leere fällt.
  useEffect(() => {
    if (notice) noticeRef.current?.focus();
  }, [notice]);

  return (
    <Page title="Nachrichten">
      <p className="lead">
        Nachrichten von der Kontaktseite der Webseite, neueste zuerst. Antworten Sie per E-Mail an die angegebene
        Adresse. Nachrichten werden spätestens sechs Monate nach Eingang automatisch gelöscht; auf Wunsch der
        absendenden Person löschen Sie sie hier sofort.
      </p>
      <p
        ref={noticeRef}
        tabIndex={-1}
        className={notice?.kind === 'error' ? 'form-error list-notice' : 'form-ok list-notice'}
        role={notice?.kind === 'error' ? 'alert' : 'status'}
      >
        {notice?.text}
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
              <MessageItem key={m.id} message={m} onNotice={setNotice} />
            ))}
          </ol>
        ))}
    </Page>
  );
}

function MessageItem({ message: m, onNotice }: { message: ContactMessage; onNotice: (n: Notice) => void }) {
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
        <DeleteMessage message={m} onNotice={onNotice} />
      </article>
    </li>
  );
}

function DeleteMessage({ message: m, onNotice }: { message: ContactMessage; onNotice: (n: Notice) => void }) {
  const { data: me } = useMe();
  const remove = useDeleteContactMessage();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirmDelete) cancelRef.current?.focus();
  }, [confirmDelete]);

  if (!me || !can(me.roles, 'deleteContactMessages')) return null;

  const cancelDelete = () => {
    setConfirmDelete(false);
    requestAnimationFrame(() => deleteRef.current?.focus());
  };

  // Die Nachricht verschwindet nach dem Löschen, daher die Meldung über das Promise statt über Callbacks.
  const confirm = async () => {
    try {
      await remove.mutateAsync(m.id);
      onNotice({ kind: 'ok', text: `Die Nachricht von ${m.name} wurde gelöscht.` });
    } catch (e) {
      setConfirmDelete(false);
      onNotice({ kind: 'error', text: `Die Nachricht von ${m.name} wurde nicht gelöscht. ${reason(e)}` });
    }
  };

  return confirmDelete ? (
    <div className="row-actions message-actions" role="group" aria-label={`Löschen der Nachricht von ${m.name} bestätigen`}>
      <span className="confirm-text">Nachricht endgültig löschen?</span>
      <button ref={cancelRef} type="button" className="btn btn-secondary btn-small press" onClick={cancelDelete}>
        Abbrechen
      </button>
      <button
        type="button"
        className="btn btn-danger btn-small press"
        disabled={remove.isPending}
        onClick={() => void confirm()}
        aria-label={`Nachricht von ${m.name} endgültig löschen`}
      >
        Ja, löschen
      </button>
    </div>
  ) : (
    <div className="row-actions message-actions">
      <button
        ref={deleteRef}
        type="button"
        className="btn btn-danger btn-small press"
        onClick={() => setConfirmDelete(true)}
        aria-label={`Nachricht von ${m.name} löschen`}
      >
        Löschen
      </button>
    </div>
  );
}

function reason(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.';
    if (e.status === 403) return 'Keine Berechtigung. Bitte laden Sie die Seite neu.';
    if (e.status === 404) return 'Die Nachricht wurde bereits gelöscht.';
  }
  return 'Bitte versuchen Sie es erneut.';
}
