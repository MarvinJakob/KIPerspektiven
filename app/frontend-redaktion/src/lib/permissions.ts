import type { components } from '../api/schema';

export type Role = components['schemas']['Role'];

/**
 * Bereiche der Redaktion nach der Rollentabelle aus Ticket #64. Das Backend prüft dieselben Regeln bei jedem
 * Seiten- und API-Aufruf; die Oberfläche blendet nur aus, was ohnehin gesperrt ist.
 */
export type Permission = 'posts' | 'insights' | 'deleteContactMessages' | 'deleteConsultations' | 'users' | 'profile';

/** Feste Reihenfolge und deutsche Bezeichnung der Rollen. */
export const ROLES: readonly { role: Role; label: string }[] = [
  { role: 'admin', label: 'Admin' },
  { role: 'editor', label: 'Redakteur' },
  { role: 'marketing', label: 'Marketing' },
];

export function can(roles: readonly Role[], permission: Permission): boolean {
  const has = (r: Role) => roles.includes(r);
  switch (permission) {
    case 'posts':
      return has('admin') || has('editor');
    case 'insights':
    case 'deleteContactMessages': // Ticket #90: wer Nachrichten liest, darf sie auf Wunsch löschen
      return has('admin') || has('marketing');
    case 'deleteConsultations':
    case 'users':
      return has('admin');
    case 'profile':
      return true;
  }
}

/** Startseite nach der Anmeldung: Admins zur Benutzerverwaltung, Redakteure zu den Beiträgen, Marketing zur Statistik. */
export function homeFor(roles: readonly Role[]): string {
  if (can(roles, 'users')) return '/benutzer';
  if (can(roles, 'posts')) return '/';
  if (can(roles, 'insights')) return '/statistik';
  return '/profil';
}

/** Rollen als lesbare Liste, z. B. „Redakteur, Marketing“. */
export const rolesLabel = (roles: readonly Role[]) =>
  ROLES.filter((r) => roles.includes(r.role))
    .map((r) => r.label)
    .join(', ');
