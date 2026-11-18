import { useEffect, useId, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ApiError } from '../api/client';
import { LANGS, LANG_NAMES, type Lang } from '../api/posts';
import { useConnectLinkedIn, useDisconnectLinkedIn, useLinkedInSettings, useSaveLinkedInSettings } from '../api/social';
import { Loading, Page } from '../components/Layout';
import { formatDate } from '../components/PostParts';
import { connectResult, enableBlocker, type LinkedInSettings } from '../lib/linkedin';

// Ticket #85: „Einstellungen → Social Media → LinkedIn“. Nur Admin-Konten; das Backend prüft dieselbe Regel bei
// Seitenaufruf und API. In dieser Ausbaustufe ist LinkedIn die einzige Plattform.

function Breadcrumb({ items }: { items: { to?: string; label: string }[] }) {
  return (
    <nav aria-label="Brotkrumen" className="breadcrumb">
      <ol>
        {items.map((i) => (
          <li key={i.label}>{i.to ? <Link to={i.to}>{i.label}</Link> : <span aria-current="page">{i.label}</span>}</li>
        ))}
      </ol>
    </nav>
  );
}

/** Übersicht der Einstellungen. */
export function SettingsPage() {
  return (
    <Page title="Einstellungen">
      <ul className="settings-list">
        <li className="card">
          <Link className="settings-link" to="/einstellungen/social-media">
            Social Media
          </Link>
          <p className="field-hint">Beiträge bei der Veröffentlichung automatisch in sozialen Netzwerken teilen.</p>
        </li>
      </ul>
    </Page>
  );
}

const statusText = (s: LinkedInSettings) =>
  !s.connected ? 'Nicht verbunden' : s.expired ? 'Autorisierung abgelaufen' : s.enabled ? 'Verbunden, automatisches Teilen an' : 'Verbunden, automatisches Teilen aus';

/** Plattformen für Social Media. */
export function SocialMediaPage() {
  const { data, isPending, isError } = useLinkedInSettings();
  return (
    <Page title="Social Media">
      <Breadcrumb items={[{ to: '/einstellungen', label: 'Einstellungen' }, { label: 'Social Media' }]} />
      <ul className="settings-list">
        <li className="card">
          <Link className="settings-link" to="/einstellungen/social-media/linkedin">
            LinkedIn
          </Link>
          <p className="field-hint">
            {isPending ? 'Status wird geladen …' : isError || !data ? 'Status nicht verfügbar.' : statusText(data)}
          </p>
        </li>
      </ul>
    </Page>
  );
}

/** Einstellungen der LinkedIn-Verbindung (REQ-85-AC1 bis AC3). */
export function LinkedInSettingsPage() {
  const { data, isPending, isError, refetch } = useLinkedInSettings();
  const save = useSaveLinkedInSettings();
  const connect = useConnectLinkedIn();
  const disconnect = useDisconnectLinkedIn();
  const [params, setParams] = useSearchParams();
  const [result] = useState(() => connectResult(params.get('verbindung')));
  const [enabled, setEnabled] = useState(false);
  const [lang, setLang] = useState<Lang>('de');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const ids = { toggle: useId(), toggleHint: useId(), lang: useId() };

  // Die Rückmeldung des OAuth-Rückrufs nur einmal zeigen; ein Neuladen zeigt den gespeicherten Stand.
  useEffect(() => {
    if (params.has('verbindung')) setParams({}, { replace: true });
  }, [params, setParams]);

  useEffect(() => {
    if (!data) return;
    setEnabled(data.enabled);
    setLang(data.preferredLang);
  }, [data]);

  if (isPending) return <Loading />;
  if (isError || !data) {
    return (
      <Page title="LinkedIn">
        <p className="form-error" role="alert">
          Die Einstellungen konnten nicht geladen werden.
        </p>
        <button type="button" className="btn btn-secondary press" onClick={() => void refetch()}>
          Erneut versuchen
        </button>
      </Page>
    );
  }

  const blocker = enableBlocker(data);
  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    setError('');
    try {
      await save.mutateAsync({ enabled, preferredLang: lang });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError && err.status < 500 ? err.message : 'Speichern ist gerade nicht möglich. Bitte erneut versuchen.');
    }
  };
  const onConnect = () => {
    setError('');
    connect.mutate(undefined, {
      onError: (err) => setError(err instanceof ApiError && err.status < 500 ? err.message : 'Die Verbindung zu LinkedIn konnte nicht begonnen werden.'),
    });
  };

  return (
    <Page title="LinkedIn">
      <Breadcrumb
        items={[
          { to: '/einstellungen', label: 'Einstellungen' },
          { to: '/einstellungen/social-media', label: 'Social Media' },
          { label: 'LinkedIn' },
        ]}
      />
      {result &&
        (result.ok ? (
          <p className="form-ok" role="status">
            {result.text}
          </p>
        ) : (
          <p className="form-error" role="alert">
            {result.text}
          </p>
        ))}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <section className="card" aria-labelledby="linkedin-verbindung">
        <h2 className="card-title" id="linkedin-verbindung">
          Verbindung
        </h2>
        <dl className="settings-facts">
          <dt>Status</dt>
          <dd>
            <strong>{!data.connected ? 'Nicht verbunden' : data.expired ? 'Autorisierung abgelaufen' : 'Verbunden'}</strong>
          </dd>
          {data.connected && (
            <>
              <dt>Ziel</dt>
              <dd>
                Persönliches Profil <strong>{data.profileName}</strong>
              </dd>
              {data.expiresAt && (
                <>
                  <dt>Autorisierung</dt>
                  <dd>
                    {data.expired ? 'Abgelaufen am' : 'Autorisierung gültig bis'} {formatDate(data.expiresAt)}
                  </dd>
                </>
              )}
            </>
          )}
        </dl>
        {!data.appConfigured && (
          <p className="field-hint">
            Für die Verbindung braucht der Server eine LinkedIn-App mit „Share on LinkedIn“ und „Sign In with LinkedIn using
            OpenID Connect“ (Umgebungsvariablen LINKEDIN_CLIENT_ID und LINKEDIN_CLIENT_SECRET, siehe Betriebsanleitung).
          </p>
        )}
        <div className="schedule-actions">
          <button
            type="button"
            className="btn btn-primary press"
            disabled={!data.appConfigured || connect.isPending}
            onClick={onConnect}
          >
            {data.connected ? 'Neu verbinden' : 'Mit LinkedIn verbinden'}
          </button>
          {data.connected && (
            <button
              type="button"
              className="btn btn-danger press"
              disabled={disconnect.isPending}
              onClick={() => disconnect.mutate(undefined, { onSuccess: () => setSaved(false) })}
            >
              Verbindung trennen
            </button>
          )}
        </div>
      </section>

      <form className="card" aria-labelledby="linkedin-teilen" onSubmit={(e) => void onSave(e)}>
        <h2 className="card-title" id="linkedin-teilen">
          Automatisch teilen
        </h2>
        <div className="field">
          <label className="check" htmlFor={ids.toggle}>
            <input
              id={ids.toggle}
              type="checkbox"
              checked={enabled}
              disabled={Boolean(blocker) && !enabled}
              aria-describedby={ids.toggleHint}
              onChange={(e) => {
                setEnabled(e.target.checked);
                setSaved(false);
              }}
            />
            Automatisch auf LinkedIn teilen
          </label>
          <span className="field-hint" id={ids.toggleHint}>
            {blocker ??
              'Neue News- und Blogbeiträge werden bei ihrer ersten Veröffentlichung mit Titel und Link geteilt. Bereits veröffentlichte Beiträge werden nicht nachträglich geteilt.'}
          </span>
        </div>
        <fieldset className="field">
          <legend>Sprache des Posts</legend>
          {LANGS.map((l) => (
            <label key={l} className="check">
              <input
                type="radio"
                name={ids.lang}
                value={l}
                checked={lang === l}
                onChange={() => {
                  setLang(l);
                  setSaved(false);
                }}
              />
              {LANG_NAMES[l]}
            </label>
          ))}
          <span className="field-hint">Hat ein Beitrag diese Fassung nicht, wird die vorhandene andere Fassung geteilt.</span>
        </fieldset>
        <div className="schedule-actions">
          <button type="submit" className="btn btn-primary press" disabled={save.isPending}>
            Einstellungen speichern
          </button>
          {saved && (
            <span className="form-ok" role="status">
              Gespeichert.
            </span>
          )}
        </div>
      </form>
    </Page>
  );
}
