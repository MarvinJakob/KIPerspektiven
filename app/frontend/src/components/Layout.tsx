import { useEffect, useMemo } from 'react';
import { Link, Outlet, ScrollRestoration, useParams } from 'react-router';
import { i18n } from '../i18n';
import { DEFAULT_LANG, LangContext, href, isLang, useLang, type Lang } from '../lib/lang';
import { BrandMark, Header } from './Header';
import { CookieSettings } from './CookieSettings';
import { footerNotes, footerPages, footerTopics, footerYearLine } from './footer';
import { NotFound } from '../pages/NotFound';

/** Rahmen aller öffentlichen Seiten: Sprache aus der URL, Kopfzeile, Inhalt, Fußzeile. */
export function LangLayout() {
  const { lang } = useParams();
  if (!isLang(lang)) {
    return (
      <Shell lang={DEFAULT_LANG}>
        <NotFound />
      </Shell>
    );
  }
  return (
    <Shell lang={lang}>
      <Outlet />
    </Shell>
  );
}

export function Shell({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const value = useMemo(() => ({ lang, t: i18n.getFixedT(lang) }), [lang]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <LangContext.Provider value={value}>
      <a className="skip-link" href="#main">
        {value.t('skip')}
      </a>
      <Header />
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <Footer />
      <ScrollRestoration />
    </LangContext.Provider>
  );
}

function Footer() {
  const { lang, t } = useLang();
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-main">
          <div className="footer-identity">
            <Link className="footer-brand" to={href(lang)}>
              <BrandMark />
              <span>{t('siteName')}</span>
            </Link>
            {footerNotes(t).map((note) => (
              <p key={note} className="footer-note">
                {note}
              </p>
            ))}
          </div>
          <nav className="footer-topics" aria-labelledby="footer-topics-title">
            <h2 id="footer-topics-title" className="footer-head">
              {t('nav.topics')}
            </h2>
            <ul className="footer-links">
              {footerTopics(lang, t).map((topic) => (
                <li key={topic.to}>
                  <Link to={topic.to}>{topic.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="footer-bottom">
          <p className="footer-copy">{footerYearLine(new Date().getFullYear(), t('siteName'))}</p>
          <nav aria-label={t('footer.site')}>
            <ul className="footer-links">
              {footerPages(lang, t).map((page) => (
                <li key={page.to}>
                  <Link to={page.to}>{page.label}</Link>
                </li>
              ))}
              <li>
                <CookieSettings />
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
