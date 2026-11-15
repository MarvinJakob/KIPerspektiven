import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { deleteReadinessResult, saveReadinessResult } from '../api/client';
import type { MaturityLevel, Ratings } from './audit';
import type { Lang } from './lang';

/** Stand der anonymen Speicherung des Ergebnisses (Ticket #130). */
export type ShareStatus = 'idle' | 'saving' | 'saved' | 'saveFailed' | 'deleted' | 'deleteFailed';

interface Assessment {
  ratings: Ratings;
  rate: (slug: string, level: MaturityLevel) => void;
  /** Einwilligung, das Ergebnis anonym zu speichern. Anfangs aus. */
  share: boolean;
  /** Setzt die Einwilligung. Zurückgenommen löscht sie ein bereits gespeichertes Ergebnis. */
  setShare: (share: boolean) => void;
  shareStatus: ShareStatus;
  /**
   * Speichert das vollständige Ergebnis, wenn eingewilligt ist und es sich seit dem letzten Speichern
   * geändert hat. Die Auswertung ruft das beim Anzeigen auf; unvollständige Ergebnisse werden nicht gesendet.
   */
  saveResult: (lang: Lang, slugs: string[]) => void;
}

const AssessmentContext = createContext<Assessment | null>(null);

/** Zufällige Kennung mit 128 Bit, hexadezimal. Sie kennzeichnet das Ergebnis dieses Browserfensters. */
function newResultKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hält die gewählten Reifegrade der Selbsteinschätzung (Ticket #113) für die ganze Anwendung, damit sie
 * beim Wechsel zwischen Dimensionen, Übersicht und Auswertung erhalten bleiben. Bewusst nur im
 * Arbeitsspeicher: Die Auswahl wird nicht im Browser gespeichert und endet mit dem Neuladen oder Schließen
 * der Seite.
 *
 * Seit Ticket #130 lässt sich das vollständige Ergebnis mit Einwilligung (Opt-in) anonym speichern. Ohne
 * Einwilligung wird nichts übertragen. Die Kennung des Ergebnisses entsteht erst beim ersten Speichern und
 * liegt wie die Einwilligung nur hier im Arbeitsspeicher, nie in Cookies oder Web Storage. Mit ihr
 * aktualisiert das Backend dasselbe Ergebnis, statt ein weiteres anzulegen.
 */
export function AssessmentProvider({ children }: { children: React.ReactNode }) {
  const [ratings, setRatings] = useState<Ratings>({});
  const [share, setShareState] = useState(false);
  const [shareStatus, setShareStatus] = useState<ShareStatus>('idle');
  const key = useRef<string | null>(null);
  /** Inhalt des zuletzt gesendeten Ergebnisses, null wenn nichts gesendet ist; verhindert erneutes Senden ohne Änderung */
  const stored = useRef<string | null>(null);
  /**
   * Ob unter der Kennung ein Ergebnis gespeichert sein kann. Ein gescheiterter Aufruf klärt das nicht
   * (ein früherer oder späterer kann gelungen sein), daher löscht das Abwählen im Zweifel; Löschen ist idempotent.
   */
  const mayBeStored = useRef(false);
  /** Aufrufe laufen nacheinander, damit ein späteres Speichern oder Löschen nie von einem früheren überholt wird. */
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = useCallback((task: () => Promise<void>) => {
    const next = queue.current.then(task);
    queue.current = next.catch(() => undefined);
    return next;
  }, []);

  const rate = useCallback((slug: string, level: MaturityLevel) => setRatings((prev) => ({ ...prev, [slug]: level })), []);

  const saveResult = useCallback(
    (lang: Lang, slugs: string[]) => {
      if (!share || slugs.length === 0 || slugs.some((s) => ratings[s] === undefined)) return;
      const body = { key: (key.current ??= newResultKey()), lang, ratings: slugs.map((s) => ({ dimension: s, level: ratings[s] })) };
      const content = JSON.stringify([body.lang, body.ratings]);
      if (content === stored.current) return;
      stored.current = content;
      mayBeStored.current = true;
      setShareStatus('saving');
      enqueue(() => saveReadinessResult(body)).then(
        () => setShareStatus('saved'),
        () => {
          // Beim nächsten Anzeigen erneut senden, aber nicht den Stand eines inzwischen gesendeten neueren Ergebnisses vergessen.
          if (stored.current === content) stored.current = null;
          setShareStatus('saveFailed');
        },
      );
    },
    [share, ratings, enqueue],
  );

  const setShare = useCallback(
    (next: boolean) => {
      setShareState(next);
      const content = stored.current;
      if (next) {
        // Nach einem gescheiterten Löschen ist das Ergebnis weiterhin gespeichert.
        setShareStatus(content === null ? 'idle' : 'saved');
        return;
      }
      if (!mayBeStored.current || key.current === null) {
        setShareStatus('idle');
        return;
      }
      const k = key.current;
      stored.current = null;
      mayBeStored.current = false;
      setShareStatus('idle');
      enqueue(() => deleteReadinessResult(k)).then(
        () => setShareStatus('deleted'),
        () => {
          // Gilt weiter als gespeichert; erneutes Abwählen versucht es noch einmal.
          mayBeStored.current = true;
          stored.current ??= content;
          setShareStatus('deleteFailed');
        },
      );
    },
    [enqueue],
  );

  const value = useMemo(
    () => ({ ratings, rate, share, setShare, shareStatus, saveResult }),
    [ratings, rate, share, setShare, shareStatus, saveResult],
  );
  return <AssessmentContext.Provider value={value}>{children}</AssessmentContext.Provider>;
}

export function useAssessment(): Assessment {
  const ctx = useContext(AssessmentContext);
  if (!ctx) throw new Error('useAssessment braucht einen AssessmentProvider');
  return ctx;
}
