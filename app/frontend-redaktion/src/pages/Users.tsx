import { useId, useState } from 'react';
import { ApiError, useMe } from '../api/client';
import { useCreateUser, useSetUserActive, useSetUserRoles, useUsers, type User } from '../api/users';
import { Loading, Page } from '../components/Layout';
import { PasswordInput } from '../components/PasswordInput';
import { formatDate } from '../components/PostParts';
import { ROLES, type Role } from '../lib/permissions';

const MIN_PASSWORD = 10;

const failure = (e: unknown, fallback: string) => (e instanceof ApiError && e.status < 500 ? e.message : fallback);

/**
 * Benutzerverwaltung für Admin-Konten (Anforderung 11, Ticket #64): Konten mit Rollen anzeigen und anlegen,
 * Rollen ändern, deaktivieren und reaktivieren. Die E-Mail-Adresse ist der Benutzername.
 */
export function UsersPage() {
  const { data: users, isPending, isError, refetch } = useUsers();
  const [notice, setNotice] = useState('');

  return (
    <Page title="Benutzerverwaltung">
      <p className="lead">
        Konten der Redaktion. Jedes Konto meldet sich mit seiner E-Mail-Adresse an und hat mindestens eine Rolle:
        Admin (alles einschließlich Benutzerverwaltung), Redakteur (Beiträge) oder Marketing (Statistik, Nachrichten
        und Beratungsanfragen lesen). Deaktivierte Konten können sich nicht mehr anmelden, offene Sitzungen enden
        sofort.
      </p>
      <p className="form-ok" role="status">
        {notice}
      </p>
      {isPending && <Loading />}
      {isError && (
        <p className="form-error" role="alert">
          Die Konten konnten nicht geladen werden.{' '}
          <button className="btn btn-secondary btn-small press" type="button" onClick={() => refetch()}>
            Erneut versuchen
          </button>
        </p>
      )}
      {users && <UserTable users={users} onNotice={setNotice} />}
      <NewUserForm onNotice={setNotice} />
    </Page>
  );
}

function UserTable({ users, onNotice }: { users: User[]; onNotice: (s: string) => void }) {
  const { data: me } = useMe();
  const setActive = useSetUserActive();
  const setRoles = useSetUserRoles();
  const [error, setError] = useState('');
  // Gewählte Rollen erscheinen sofort; nach der Antwort gilt wieder der gespeicherte Stand (bei Fehlern der alte).
  const [pending, setPending] = useState<Record<number, Role[]>>({});
  const rolesOf = (u: User) => pending[u.id] ?? u.roles;

  const toggle = (u: User) => {
    setError('');
    onNotice('');
    setActive.mutate(
      { id: u.id, active: !u.active },
      {
        onSuccess: (r) =>
          onNotice(
            r.active
              ? `${r.email} ist wieder aktiv und kann sich anmelden.`
              : `${r.email} ist deaktiviert. Offene Sitzungen wurden beendet.`,
          ),
        onError: (e) => setError(failure(e, 'Ändern ist gerade nicht möglich.')),
      },
    );
  };

  const changeRole = (u: User, role: Role, on: boolean) => {
    setError('');
    onNotice('');
    const current = rolesOf(u);
    const roles = on ? [...current, role] : current.filter((r) => r !== role);
    if (roles.length === 0) {
      setError(`${u.email} braucht mindestens eine Rolle.`);
      return;
    }
    setPending((p) => ({ ...p, [u.id]: roles }));
    setRoles.mutate(
      { id: u.id, roles },
      {
        onSuccess: (r) => onNotice(`Rollen von ${r.email} gespeichert.`),
        onError: (e) => setError(failure(e, 'Die Rollen konnten gerade nicht geändert werden.')),
        onSettled: () =>
          setPending((p) => {
            const { [u.id]: _done, ...rest } = p;
            return rest;
          }),
      },
    );
  };

  return (
    <>
      <p className="form-error" role="alert">
        {error}
      </p>
      <div className="table-wrap">
        <table className="table">
          <caption className="visually-hidden">Redaktionskonten</caption>
          <thead>
            <tr>
              <th scope="col">E-Mail-Adresse</th>
              <th scope="col">Rollen</th>
              <th scope="col">Status</th>
              <th scope="col">Angelegt</th>
              <th scope="col" className="actions">
                <span className="visually-hidden">Aktion</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const self = u.id === me?.id;
              const isAdmin = u.roles.includes('admin');
              return (
                <tr key={u.id}>
                  <td>
                    {u.email}
                    {self && <span className="row-meta"> Sie</span>}
                    {u.displayName && <span className="row-sub">{u.displayName}</span>}
                  </td>
                  <td>
                    <div className="checks checks-compact" role="group" aria-label={`Rollen von ${u.email}`}>
                      {ROLES.map(({ role, label }) => (
                        <label className="check" key={role}>
                          <input
                            type="checkbox"
                            checked={rolesOf(u).includes(role)}
                            // Einem Admin-Konto lässt sich die Admin-Rolle nicht entziehen (REQ-64-AC3).
                            disabled={setRoles.isPending || (role === 'admin' && isAdmin)}
                            onChange={(e) => changeRole(u, role, e.target.checked)}
                            aria-label={`${u.email}: ${label}`}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </td>
                  <td>
                    {u.active ? (
                      <span className="badge badge-published">Aktiv</span>
                    ) : (
                      <span className="badge badge-inactive">Deaktiviert</span>
                    )}
                  </td>
                  <td className="num">{formatDate(u.createdAt)}</td>
                  <td className="actions">
                    {!self && (
                      <button
                        type="button"
                        className={`btn btn-small press ${u.active ? 'btn-danger' : 'btn-secondary'}`}
                        disabled={setActive.isPending}
                        onClick={() => toggle(u)}
                        aria-label={`${u.email} ${u.active ? 'deaktivieren' : 'reaktivieren'}`}
                      >
                        {u.active ? 'Deaktivieren' : 'Reaktivieren'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function NewUserForm({ onNotice }: { onNotice: (s: string) => void }) {
  const create = useCreateUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roles, setRoles] = useState<Role[]>([]);
  const [error, setError] = useState('');
  const ids = { email: useId(), password: useId(), hint: useId(), error: useId(), heading: useId() };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onNotice('');
    const problem = !email.trim()
      ? 'Bitte eine E-Mail-Adresse angeben.'
      : password.length < MIN_PASSWORD
        ? `Das Startpasswort muss mindestens ${MIN_PASSWORD} Zeichen lang sein.`
        : roles.length === 0
          ? 'Bitte mindestens eine Rolle wählen.'
          : '';
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    create.mutate(
      { email, password, roles },
      {
        onSuccess: (u) => {
          setEmail('');
          setPassword('');
          setRoles([]);
          onNotice(`Konto ${u.email} angelegt. Teilen Sie das Startpasswort auf einem sicheren Weg mit.`);
        },
        onError: (e) => setError(failure(e, 'Anlegen ist gerade nicht möglich.')),
      },
    );
  };

  return (
    <section className="card" aria-labelledby={ids.heading}>
      <h2 id={ids.heading} className="card-title">
        Neues Konto
      </h2>
      <form onSubmit={submit} noValidate className="inline-form">
        <div className="field">
          <label htmlFor={ids.email}>E-Mail-Adresse</label>
          <input
            id={ids.email}
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-describedby={error ? ids.error : undefined}
          />
        </div>
        <div className="field">
          <label htmlFor={ids.password}>Startpasswort</label>
          <PasswordInput
            id={ids.password}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby={`${ids.hint}${error ? ` ${ids.error}` : ''}`}
          />
          <span className="field-hint" id={ids.hint}>
            Mindestens {MIN_PASSWORD} Zeichen.
          </span>
        </div>
        <fieldset className="field roles-field">
          <legend>Rollen</legend>
          <div className="checks">
            {ROLES.map(({ role, label }) => (
              <label className="check" key={role}>
                <input
                  type="checkbox"
                  checked={roles.includes(role)}
                  onChange={(e) => setRoles((rs) => (e.target.checked ? [...rs, role] : rs.filter((r) => r !== role)))}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="inline-form-actions">
          <button type="submit" className="btn btn-primary press" disabled={create.isPending}>
            Konto anlegen
          </button>
        </div>
      </form>
      <p className="form-error" id={ids.error} role="alert">
        {error}
      </p>
    </section>
  );
}
