import { useId } from 'react';
import { Link } from 'react-router';
import { useAssessment } from '../lib/assessment';
import { href, useLang } from '../lib/lang';

/**
 * Einwilligung in die anonyme Speicherung des Ergebnisses (Ticket #130, Opt-in). Steht im letzten Schritt
 * vor „Auswertung anzeigen“ und auf der Auswertung, wo sie sich auch nachträglich setzen oder zurücknehmen
 * lässt. Ohne Haken wird nichts übertragen; die Auswertung erscheint in jedem Fall. Die Statuszeile meldet
 * Speichern, Fehler und Löschen auch Screenreadern.
 */
export function ShareConsent() {
  const { lang, t } = useLang();
  const { share, setShare, shareStatus } = useAssessment();
  const id = useId();
  const hintId = `${id}-hinweis`;

  return (
    <div className="share-consent">
      <div className="share-check">
        <input type="checkbox" id={id} checked={share} onChange={(e) => setShare(e.target.checked)} aria-describedby={hintId} />
        <label htmlFor={id}>{t('assess.share.label')}</label>
      </div>
      <p className="share-hint" id={hintId}>
        {t('assess.share.hint')} <Link to={href(lang, '/datenschutz')}>{t('assess.share.privacyLink')}</Link>
      </p>
      <p className="share-status" role="status" data-status={shareStatus}>
        {shareStatus === 'idle' ? '' : t(`assess.share.${shareStatus}`)}
      </p>
    </div>
  );
}
