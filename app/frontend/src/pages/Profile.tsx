import { Link } from 'react-router';
import portrait from '../assets/marvin-jakob.jpg';
import { Icon } from '../components/Icon';
import { PROFILE_MAIL, profile } from '../i18n/profile';
import { href, useLang } from '../lib/lang';
import { useHead, usePageFocus } from '../lib/page';

/**
 * Profilseite nach content/Persona.md (Ticket #124). Die Abschnitte folgen der Reihenfolge der Vorlage:
 * Vorstellung mit Porträt, Beschreibung, Fakten, Kontakt und Beratungsangebote.
 */
export function Profile() {
  const { lang, t } = useLang();
  const content = profile[lang];
  const h1 = usePageFocus<HTMLHeadingElement>();
  useHead(content.title, content.description);

  return (
    <article className="container profile">
      <nav className="crumbs profile-crumbs" aria-label={t('crumbs')}>
        <Link to={href(lang)}>{content.home}</Link>
        <span aria-hidden="true">/</span><span aria-current="page">Marvin Jakob</span>
      </nav>
      <header className="profile-hero">
        <div>
          <p className="eyebrow">{content.label}</p>
          <h1 className="page-title" tabIndex={-1} ref={h1}>Marvin Jakob</h1>
          <p className="profile-headline">{content.headline}<br /><span>{content.headlineAccent}</span></p>
          <p className="profile-motto">{content.motto}</p>
          <ul className="profile-tags" aria-label={content.focusLabel}>
            {content.tags.map((tag) => <li key={tag}>{tag}</li>)}
          </ul>
          <a className="btn btn-primary press" href="#offers-title">
            {content.discover} <span aria-hidden="true">↓</span>
          </a>
        </div>
        <figure className="profile-portrait">
          <img src={portrait} alt={content.portraitAlt} width={1024} height={1024} fetchPriority="high" />
          <figcaption><strong>{content.role}</strong><span>{content.caption}</span></figcaption>
        </figure>
      </header>
      <section className="profile-about" aria-labelledby="about-title">
        <h2 id="about-title">{content.aboutTitle}</h2>
        <div className="profile-about-text">{content.about.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
      </section>
      <dl className="profile-facts" aria-label={content.factsLabel}>
        {content.facts.map((fact) => <div key={fact.title}><dt>{fact.title}</dt><dd>{fact.text}</dd></div>)}
      </dl>
      <section className="profile-contact" aria-labelledby="contact-title">
        <h2 id="contact-title">{content.contactTitle}</h2>
        <ul>
          <li><a className="btn btn-secondary press" href={content.linkedinUrl} target="_blank" rel="noopener noreferrer" aria-label={content.linkedinLabel}><Icon name="linkedin" />LinkedIn</a></li>
          <li><a className="btn btn-secondary press" href={`mailto:${PROFILE_MAIL}`}><Icon name="mail" />{content.mailLabel}</a></li>
        </ul>
      </section>
      <section className="profile-section" aria-labelledby="offers-title">
        <h2 id="offers-title" tabIndex={-1}>{content.offersTitle}</h2>
        <div className="profile-offers">
          {content.offers.map((offer, index) => (
            <section className="profile-card profile-offer" key={offer.title} aria-labelledby={`offer-${index}`}>
              <div>
                <span className="profile-offer-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <h3 id={`offer-${index}`}>{offer.title}</h3>
                <p>{offer.text}</p>
              </div>
              <dl>
                <div><dt>{content.scopeLabel}</dt><dd>{offer.scope}</dd></div>
                <div><dt>{content.resultLabel}</dt><dd>{offer.result}</dd></div>
              </dl>
            </section>
          ))}
        </div>
      </section>
    </article>
  );
}
