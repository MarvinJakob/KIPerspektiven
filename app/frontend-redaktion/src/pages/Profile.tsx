import { useEffect, useId, useRef, useState } from 'react';
import { ApiError } from '../api/client';
import { useChangePassword, useProfile, useSaveDisplayName, useUploadAvatar, type Profile } from '../api/profile';
import { Loading, Page } from '../components/Layout';
import { PasswordInput } from '../components/PasswordInput';
import { rolesLabel } from '../lib/permissions';

const MIN_PASSWORD = 10;
const MAX_NAME = 80;

const failure = (e: unknown, fallback: string) => (e instanceof ApiError && e.status < 500 ? e.message : fallback);

/**
 * Eigenes Profil (Ticket #64): Anzeigename, Profilbild und Passwort. Jedes angemeldete Konto erreicht die Seite.
 * Rollen sind hier nur zu sehen; sie verwaltet die Administration.
 */
export function ProfilePage() {
  const { data: profile, isPending, isError, refetch } = useProfile();
  return (
    <Page title="Profil">
      {isPending && <Loading />}
      {isError && (
        <p className="form-error" role="alert">
          Das Profil konnte nicht geladen werden.{' '}
          <button className="btn btn-secondary btn-small press" type="button" onClick={() => refetch()}>
            Erneut versuchen
          </button>
        </p>
      )}
      {profile && (
        <div className="profile-grid">
          <section className="card" aria-labelledby="profil-konto">
            <h2 id="profil-konto" className="card-title">
              Konto
            </h2>
            <dl className="meta-list">
              <dt>E-Mail-Adresse (Benutzername)</dt>
              <dd>{profile.email}</dd>
              <dt>Rollen</dt>
              <dd>{rolesLabel(profile.roles)}</dd>
            </dl>
          </section>
          <NameForm profile={profile} />
          <AvatarForm profile={profile} />
          <PasswordForm />
        </div>
      )}
    </Page>
  );
}

function NameForm({ profile }: { profile: Profile }) {
  const save = useSaveDisplayName();
  const [name, setName] = useState(profile.displayName);
  const [ok, setOk] = useState('');
  const [error, setError] = useState('');
  const ids = { name: useId(), hint: useId(), error: useId() };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setOk('');
    if (name.trim().length > MAX_NAME) {
      setError(`Der Name darf höchstens ${MAX_NAME} Zeichen lang sein.`);
      return;
    }
    setError('');
    save.mutate(name, {
      onSuccess: (p) => {
        setName(p.displayName);
        setOk('Name gespeichert.');
      },
      onError: (err) => setError(failure(err, 'Der Name konnte gerade nicht gespeichert werden.')),
    });
  };

  return (
    <section className="card" aria-labelledby="profil-name">
      <h2 id="profil-name" className="card-title">
        Name
      </h2>
      <form className="form-stack" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor={ids.name}>Anzeigename</label>
          <input
            id={ids.name}
            type="text"
            autoComplete="name"
            value={name}
            maxLength={MAX_NAME + 20}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={`${ids.hint}${error ? ` ${ids.error}` : ''}`}
          />
          <span className="field-hint" id={ids.hint}>
            Erscheint als Autorenname bei Ihren veröffentlichten Beiträgen. Höchstens {MAX_NAME} Zeichen; leer lassen,
            um keinen Namen anzuzeigen.
          </span>
        </div>
        <button type="submit" className="btn btn-primary press" disabled={save.isPending}>
          Namen speichern
        </button>
      </form>
      <p className="form-ok" role="status">
        {ok}
      </p>
      <p className="form-error" id={ids.error} role="alert">
        {error}
      </p>
    </section>
  );
}

function AvatarForm({ profile }: { profile: Profile }) {
  const upload = useUploadAvatar();
  const [ok, setOk] = useState('');
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const ids = { file: useId(), hint: useId(), error: useId() };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOk('');
    setError('');
    upload.mutate(file, {
      onSuccess: () => setOk('Profilbild gespeichert.'),
      // Ein abgelehnter Upload ändert das bisherige Bild nicht (REQ-64-AC8).
      onError: (err) => setError(failure(err, 'Das Profilbild konnte gerade nicht gespeichert werden.')),
      onSettled: () => {
        if (input.current) input.current.value = '';
      },
    });
  };

  return (
    <section className="card" aria-labelledby="profil-bild">
      <h2 id="profil-bild" className="card-title">
        Profilbild
      </h2>
      <div className="profile-avatar">
        {profile.avatar ? (
          <img src={profile.avatar.src} alt="Ihr Profilbild" width={96} height={96} />
        ) : (
          <span className="profile-avatar-empty">Kein Bild</span>
        )}
        <div className="field">
          <label htmlFor={ids.file}>Profilbild hochladen</label>
          <input
            ref={input}
            id={ids.file}
            className="file-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onChange}
            disabled={upload.isPending}
            aria-describedby={`${ids.hint}${error ? ` ${ids.error}` : ''}`}
          />
          <span className="field-hint" id={ids.hint}>
            JPEG, PNG oder WebP bis 5 MB. Das Bild erscheint neben Ihrem Namen bei Ihren Beiträgen.
          </span>
        </div>
      </div>
      <p className="form-ok" role="status">
        {upload.isPending ? 'Profilbild wird hochgeladen …' : ok}
      </p>
      <p className="form-error" id={ids.error} role="alert">
        {error}
      </p>
    </section>
  );
}

function PasswordForm() {
  const change = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [ok, setOk] = useState('');
  const [error, setError] = useState('');
  const errorRef = useRef<HTMLParagraphElement>(null);
  const ids = { current: useId(), next: useId(), hint: useId(), error: useId() };

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: 'nearest' });
  }, [error]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setOk('');
    if (!current || next.length < MIN_PASSWORD) {
      setError(!current ? 'Bitte das aktuelle Passwort angeben.' : `Das neue Passwort muss mindestens ${MIN_PASSWORD} Zeichen lang sein.`);
      return;
    }
    setError('');
    change.mutate(
      { currentPassword: current, newPassword: next },
      {
        onSuccess: () => {
          setCurrent('');
          setNext('');
          setOk('Passwort geändert. Melden Sie sich künftig mit dem neuen Passwort an.');
        },
        onError: (err) => setError(failure(err, 'Das Passwort konnte gerade nicht geändert werden.')),
      },
    );
  };

  return (
    <section className="card" aria-labelledby="profil-passwort">
      <h2 id="profil-passwort" className="card-title">
        Passwort
      </h2>
      <form className="form-stack" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor={ids.current}>Aktuelles Passwort</label>
          <PasswordInput
            id={ids.current}
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            aria-describedby={error ? ids.error : undefined}
          />
        </div>
        <div className="field">
          <label htmlFor={ids.next}>Neues Passwort</label>
          <PasswordInput
            id={ids.next}
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            aria-describedby={`${ids.hint}${error ? ` ${ids.error}` : ''}`}
          />
          <span className="field-hint" id={ids.hint}>
            Mindestens {MIN_PASSWORD} Zeichen. Andere angemeldete Geräte werden dabei abgemeldet.
          </span>
        </div>
        <button type="submit" className="btn btn-primary press" disabled={change.isPending}>
          Passwort ändern
        </button>
      </form>
      <p className="form-ok" role="status">
        {ok}
      </p>
      <p className="form-error" id={ids.error} role="alert" ref={errorRef}>
        {error}
      </p>
    </section>
  );
}
