import { can, type Permission, type Role } from './permissions';

/**
 * Ziele der Seitenleiste (Ticket #103) in fester Reihenfolge. Die Sichtbarkeit folgt der Rollentabelle aus #64;
 * das Backend schützt die Bereiche unabhängig davon bei jedem Seiten- und API-Aufruf.
 */
export type NavIcon = 'posts' | 'articles' | 'statistics' | 'consultations' | 'messages' | 'users' | 'settings' | 'profile';

export interface NavItem {
  to: string;
  label: string;
  icon: NavIcon;
  /** Nur bei exakt passendem Pfad aktiv (Beitragsliste unter „/“). */
  end?: boolean;
}

const ITEMS: readonly (NavItem & { permission: Permission })[] = [
  { to: '/', label: 'Beiträge', icon: 'posts', end: true, permission: 'posts' },
  { to: '/themenartikel', label: 'Themenartikel', icon: 'articles', permission: 'posts' },
  { to: '/statistik', label: 'Statistik', icon: 'statistics', permission: 'insights' },
  { to: '/beratungsanfragen', label: 'Beratungsanfragen', icon: 'consultations', permission: 'insights' },
  { to: '/nachrichten', label: 'Nachrichten', icon: 'messages', permission: 'insights' },
  { to: '/benutzer', label: 'Benutzer', icon: 'users', permission: 'users' },
  { to: '/einstellungen', label: 'Einstellungen', icon: 'settings', permission: 'settings' },
  { to: '/profil', label: 'Profil', icon: 'profile', permission: 'profile' },
];

export function navItems(roles: readonly Role[]): NavItem[] {
  return ITEMS.filter((i) => can(roles, i.permission)).map(({ permission: _p, ...item }) => item);
}

/** Bis zu dieser Fensterbreite (px) gilt die schmale Ansicht mit überlagernder Navigation. Muss zu styles.css passen. */
export const NARROW_MAX_WIDTH = 899;
export const NARROW_QUERY = `(max-width: ${NARROW_MAX_WIDTH}px)`;

/** Gewählter Zustand der Seitenleiste, nur im Browser gespeichert. */
export const SIDEBAR_KEY = 'ki-perspektiven.redaktion.seitenleiste';

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

const defaultStore = (): KeyValueStore | undefined => {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
};

export function readSidebarCollapsed(store: KeyValueStore | undefined = defaultStore()): boolean {
  try {
    return store?.getItem(SIDEBAR_KEY) === 'collapsed';
  } catch {
    return false;
  }
}

export function storeSidebarCollapsed(collapsed: boolean, store: KeyValueStore | undefined = defaultStore()) {
  try {
    store?.setItem(SIDEBAR_KEY, collapsed ? 'collapsed' : 'expanded');
  } catch {
    /* privat oder blockiert: gilt dann nur bis zum Neuladen */
  }
}
