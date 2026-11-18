import type { TFunction } from 'i18next';
import type { ConsentMode } from '../lib/consent';

export interface StorageOption {
  mode: ConsentMode;
  label: string;
}

/** Auswahl-Schaltflächen des Cookie-Dialogs in fester Reihenfolge. */
export function storageOptions(t: TFunction, optional: boolean): StorageOption[] {
  const options: StorageOption[] = [
    { mode: 'none', label: t('cookies.none') },
    { mode: 'necessary', label: t('cookies.necessary') },
  ];
  if (optional) options.push({ mode: 'all', label: t('cookies.all') });
  return options;
}

/** Statusmeldung nach einer Auswahl; bei „none“ samt Hinweis zur Gültigkeit bis zum Neuladen. */
export function consentStatus(t: TFunction, mode: ConsentMode): string {
  const saved = t(`cookies.saved.${mode}`);
  return mode === 'none' ? `${saved} ${t('cookies.noneHint')}` : saved;
}
