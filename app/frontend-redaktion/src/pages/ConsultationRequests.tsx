import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client';
import { useConsultationRequests, useDeleteConsultationRequest, type ConsultationRequest } from '../api/consultations';
import { Loading, Page } from '../components/Layout';

interface Notice {
  kind: 'ok' | 'error';
  text: string;
}

const LANG_NAMES: Record<string, string> = { de: 'Deutsch', en: 'Englisch' };

// Uhrzeiten in deutscher Zeit, wie in der Statistik.
const ZONE = 'Europe/Berlin';
const dateFormat = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: ZONE });
const timeFormat = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: ZONE });
const formatAt = (iso: string) => `${dateFormat.format(new Date(iso))}, ${timeFormat.format(new Date(iso))} Uhr`;

/**
 * Anfragen für ein kostenloses Beratungsgespräch (Ticket #136, ADR 0011). Hier kommen die Anfragen aus der
 * Auswertung der Selbsteinschätzung an. Die Redaktion meldet sich per E-Mail zur Terminabstimmung und löscht
 * die Anfrage danach, damit keine Adressen länger als nötig gespeichert bleiben.
 */
export function ConsultationRequestsPage() {
  const { data: items, isPending, isError, refetch } = useConsultationRequests();
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);

  // Wie in der Beitragsliste: Die Meldung erhält den Fokus, damit er nach dem Löschen nicht ins Leere fällt.
  useEffect(() => {
    if (notice) noticeRef.current?.focus();
  }, [notice]);

  return (
    <Page title="Beratungsanfragen">
      <p className="lead">
        Anfragen für ein kostenloses Beratungsgespräch aus der Auswertung der KI-Readiness-Selbsteinschätzung, neueste
        zuerst. Gespeichert sind nur E-Mail-Adresse, Sprache der Seite und Zeitpunkt, nicht das Ergebnis. Melden Sie sich
        per E-Mail zur Terminabstimmung und löschen Sie die Anfrage, sobald der Termin abgestimmt ist.
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
          Die Anfragen konnten nicht geladen werden.{' '}
          <button className="btn btn-secondary btn-small press" type="button" onClick={() => refetch()}>
            Erneut versuchen
          </button>
        </p>
      )}
      {items &&
        (items.length === 0 ? (
          <p className="empty-state card">Es liegen keine offenen Anfragen vor.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <caption className="visually-hidden">Offene Beratungsanfragen, neueste zuerst</caption>
              <thead>
                <tr>
                  <th scope="col">Eingang</th>
                  <th scope="col">E-Mail-Adresse</th>
                  <th scope="col">Sprache</th>
                  <th scope="col" className="actions">
                    <span className="visually-hidden">Aktionen</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <Row key={r.id} request={r} onNotice={setNotice} />
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </Page>
  );
}

function Row({ request: r, onNotice }: { request: ConsultationRequest; onNotice: (n: Notice) => void }) {
  const remove = useDeleteConsultationRequest();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirmDelete) cancelRef.current?.focus();
  }, [confirmDelete]);

  const cancelDelete = () => {
    setConfirmDelete(false);
    requestAnimationFrame(() => deleteRef.current?.focus());
  };

  // Die Zeile verschwindet nach dem Löschen, daher die Meldung über das Promise statt über Callbacks.
  const confirm = async () => {
    try {
      await remove.mutateAsync(r.id);
      onNotice({ kind: 'ok', text: `Die Anfrage von ${r.email} wurde gelöscht.` });
    } catch (e) {
      setConfirmDelete(false);
      onNotice({ kind: 'error', text: `Die Anfrage von ${r.email} wurde nicht gelöscht. ${reason(e)}` });
    }
  };

  return (
    <tr>
      <td className="num">
        <time dateTime={r.requestedAt}>{formatAt(r.requestedAt)}</time>
      </td>
      <td>
        <a href={`mailto:${r.email}`}>{r.email}</a>
      </td>
      <td>{LANG_NAMES[r.lang] ?? r.lang}</td>
      <td className="actions">
        {confirmDelete ? (
          <div className="row-actions" role="group" aria-label={`Löschen der Anfrage von ${r.email} bestätigen`}>
            <span className="confirm-text">Termin abgestimmt? Endgültig löschen?</span>
            <button ref={cancelRef} type="button" className="btn btn-secondary btn-small press" onClick={cancelDelete}>
              Abbrechen
            </button>
            <button
              type="button"
              className="btn btn-danger btn-small press"
              disabled={remove.isPending}
              onClick={() => void confirm()}
              aria-label={`Anfrage von ${r.email} endgültig löschen`}
            >
              Ja, löschen
            </button>
          </div>
        ) : (
          <div className="row-actions">
            <button
              ref={deleteRef}
              type="button"
              className="btn btn-danger btn-small press"
              onClick={() => setConfirmDelete(true)}
              aria-label={`Anfrage von ${r.email} löschen`}
            >
              Löschen
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

function reason(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.';
    if (e.status === 403) return 'Keine Berechtigung. Bitte laden Sie die Seite neu.';
    if (e.status === 404) return 'Die Anfrage wurde bereits gelöscht.';
  }
  return 'Bitte versuchen Sie es erneut.';
}
