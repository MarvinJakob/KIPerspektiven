import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router';
import { useLogout, useMe, type Me } from '../api/client';
import { NARROW_QUERY, navItems, readSidebarCollapsed, storeSidebarCollapsed, type NavIcon } from '../lib/navigation';
import { can, rolesLabel, type Permission } from '../lib/permissions';
import { ThemeToggle } from './ThemeToggle';

/**
 * Gemeinsames Layout aller geschützten Redaktionsseiten. Ohne gültige Sitzung führt es zur Anmeldung.
 * Die eigentliche Prüfung macht das Backend bei jedem Seiten- und API-Aufruf (Anforderung 6).
 */
export function Layout() {
  const { data: me, isPending, isError, refetch } = useMe();

  if (isPending) return <Loading />;
  if (isError) {
    return (
      <main className="page container" id="inhalt">
        <h1>Verbindung fehlgeschlagen</h1>
        <p className="lead">Die Anmeldung konnte nicht geprüft werden.</p>
        <button className="btn btn-secondary press" type="button" onClick={() => refetch()}>
          Erneut versuchen
        </button>
      </main>
    );
  }
  if (!me) return <Navigate to="/anmelden" replace />;

  return <Shell me={me} />;
}

/** Folgt einer Media Query, z. B. der schmalen Ansicht (Ticket #103). */
function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}

/**
 * Rahmen mit einklappbarer Seitenleiste (Ticket #103). Ab 900 px steht die Navigation links und lässt sich
 * auf Symbole einklappen; die Wahl bleibt im Browser gespeichert. Darunter öffnet die Schaltfläche „Navigation“
 * dieselbe Leiste als überlagernden Dialog. Schließen ohne Zielwechsel führt den Fokus zur Schaltfläche zurück,
 * nach einer Auswahl setzt die Zielseite den Fokus auf ihre Überschrift.
 */
function Shell({ me }: { me: Me }) {
  const narrow = useMediaQuery(NARROW_QUERY);
  const [collapsed, setCollapsed] = useState(readSidebarCollapsed);
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const overlay = narrow && open;

  const toggleCollapsed = () => {
    const next = !collapsed;
    storeSidebarCollapsed(next);
    setCollapsed(next);
  };
  const closeOverlay = () => {
    restoreFocus.current = true;
    setOpen(false);
  };

  // Breite Ansicht kennt keine Überlagerung.
  useEffect(() => {
    if (!narrow) setOpen(false);
  }, [narrow]);

  useEffect(() => {
    if (overlay) {
      closeButton.current?.focus();
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeOverlay();
        }
      };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }
    if (restoreFocus.current) {
      restoreFocus.current = false;
      menuButton.current?.focus();
    }
  }, [overlay]);

  const compact = collapsed && !narrow;

  return (
    <>
      <a className="skip-link" href="#inhalt">
        Zum Inhalt springen
      </a>
      <div className={`ed-shell${compact ? ' is-collapsed' : ''}`}>
        <header className="ed-topbar glass" inert={overlay}>
          <button
            ref={menuButton}
            className="icon-btn press"
            type="button"
            aria-label="Navigation"
            aria-expanded={overlay}
            aria-controls="ed-sidebar"
            onClick={() => setOpen(true)}
          >
            <Icon name="menu" />
          </button>
          <span className="ed-topbar-title">
            <span className="brand-mark" aria-hidden="true" />
            Redaktion
          </span>
        </header>
        {overlay && <div className="ed-backdrop" aria-hidden="true" onClick={closeOverlay} />}
        <aside
          id="ed-sidebar"
          className={`ed-sidebar glass${overlay ? ' is-open' : ''}`}
          role={narrow ? 'dialog' : undefined}
          aria-modal={overlay || undefined}
          aria-label={narrow ? 'Navigation' : undefined}
        >
          <div className="ed-sidebar-head">
            <a className="brand press" href="/" aria-label="KI Perspektiven – zur öffentlichen Webseite" title="Zur öffentlichen Webseite">
              <span className="brand-mark" aria-hidden="true" />
              <span className="brand-name">Redaktion</span>
            </a>
            <button
              className="icon-btn press ed-collapse"
              type="button"
              aria-label="Seitenleiste"
              title={collapsed ? 'Seitenleiste ausklappen' : 'Seitenleiste einklappen'}
              aria-expanded={!collapsed}
              aria-controls="ed-nav"
              onClick={toggleCollapsed}
            >
              <Icon name={collapsed ? 'expand' : 'collapse'} />
            </button>
            <button ref={closeButton} className="icon-btn press ed-close" type="button" aria-label="Navigation schließen" onClick={closeOverlay}>
              <Icon name="close" />
            </button>
          </div>
          <nav id="ed-nav" className="ed-nav" aria-label="Redaktion">
            <ul>
              {navItems(me.roles).map((item) => (
                <li key={item.to}>
                  <NavLink
                    className="ed-nav-link press"
                    to={item.to}
                    end={item.end}
                    aria-label={compact ? item.label : undefined}
                    title={compact ? item.label : undefined}
                    onClick={() => setOpen(false)}
                  >
                    <Icon name={item.icon} />
                    <span className="nav-label">{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <Account me={me} />
        </aside>
        <main className="page container" id="inhalt" tabIndex={-1} inert={overlay}>
          <Outlet context={me} />
        </main>
      </div>
    </>
  );
}

/** Kontoinformationen, Farbschema und Abmeldung am Fuß der Seitenleiste. */
function Account({ me }: { me: Me }) {
  const logout = useLogout();
  const navigate = useNavigate();
  const onLogout = () => logout.mutate(undefined, { onSettled: () => navigate('/anmelden', { replace: true }) });
  const name = me.displayName || me.email;

  return (
    <div className="ed-account">
      <span className="ed-user" title={`${name} (${rolesLabel(me.roles)})`}>
        <span className="ed-avatar" aria-hidden="true">
          {name.charAt(0).toUpperCase()}
        </span>
        <span className="ed-user-text">
          <span className="ed-user-name">{name}</span>
          <span className="ed-role">{rolesLabel(me.roles)}</span>
        </span>
      </span>
      <div className="ed-account-actions">
        <ThemeToggle />
        <button className="btn btn-secondary btn-small press ed-logout" type="button" aria-label="Abmelden" title="Abmelden" onClick={onLogout} disabled={logout.isPending}>
          <Icon name="logout" />
          <span className="nav-label">Abmelden</span>
        </button>
      </div>
    </div>
  );
}

const ICONS: Record<NavIcon | 'menu' | 'close' | 'collapse' | 'expand' | 'logout', React.ReactNode> = {
  posts: <path d="M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5" />,
  articles: <path d="M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2zM4 20a1 1 0 0 0 1 1h14M8 7h7" />,
  statistics: <path d="M4 20h16M7 16v-5M12 16V6M17 16v-8" />,
  consultations: <path d="M4 5h16v11H9l-5 4zM8 9h8M8 12h5" />,
  messages: <path d="M3 6h18v12H3zM3 7l9 6 9-6" />,
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 6" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  collapse: <path d="M4 4h16v16H4zM9 4v16M16 9l-3 3 3 3" />,
  expand: <path d="M4 4h16v16H4zM9 4v16M13 9l3 3-3 3" />,
  logout: <path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10" />,
};

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {ICONS[name]}
    </svg>
  );
}

/** Zeigt den Inhalt nur mit passender Rolle (Ticket #64). Sonst erscheint ein Hinweis statt der Seite. */
export function RequireRole({ can: permission, children }: { can: Permission; children: React.ReactNode }) {
  const { data: me } = useMe();
  if (!me) return null;
  if (!can(me.roles, permission)) return <Forbidden can={permission} />;
  return <>{children}</>;
}

function Forbidden({ can }: { can: Permission }) {
  return (
    <Page title="Keine Berechtigung">
      <p className="lead">
        {can === 'users'
          ? 'Die Benutzerverwaltung ist Admin-Konten vorbehalten.'
          : 'Ihr Konto hat keinen Zugriff auf diesen Bereich.'}{' '}
        Wenden Sie sich bei Bedarf an die Administration.
      </p>
    </Page>
  );
}

/** Seitenrahmen: setzt den Titel und setzt den Fokus nach einem Seitenwechsel auf die Überschrift. */
export function Page({ title, actions, children }: { title: string; actions?: React.ReactNode; children?: React.ReactNode }) {
  const h1 = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    document.title = `${title} – Redaktion – KI Perspektiven`;
    h1.current?.focus();
  }, [title]);
  return (
    <>
      <div className="page-head">
        <h1 ref={h1} tabIndex={-1}>
          {title}
        </h1>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
      {children}
    </>
  );
}

export function Loading() {
  return (
    <p className="loading" role="status">
      Wird geladen …
    </p>
  );
}
