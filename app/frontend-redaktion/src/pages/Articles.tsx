import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useOutletContext, useParams } from 'react-router';
import { client, unwrap, type Me } from '../api/client';
import { useAuthors, type AuthorOption } from '../api/posts';
import type { components } from '../api/schema';
import { ArticleEditor, type ArticleLayout } from '../components/ArticleEditor';
import { Loading, Page } from '../components/Layout';
import './Articles.css';

type Article = components['schemas']['EditorArticle'];
type Content = components['schemas']['ArticleText'];
type Block = components['schemas']['ArticleBlock'];
type Status = Article['status'];
type Language = 'de' | 'en';
const directory = '/themenartikel';
const listKey = ['admin', 'articles'];
const detailKey = (id: number) => ['admin', 'article', id];
const emptyText = (): Content => ({ title: '', blocks: [] });
const LAYOUTS: [ArticleLayout, string][] = [['column', 'Schmale Lesespalte'], ['wide', 'Breiter Lesefluss'], ['magazine', 'Magazin']];

/** Vergleichbare Fassung unabhängig von der Reihenfolge der Felder; so gilt nur echter Inhalt als Änderung. */
const stable = (value: unknown): string =>
  JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);

/** Bild ohne Alternativtext, auch innerhalb von Abschnitten (REQ-136-AC10). */
const missingAlt = (blocks: Block[]): boolean =>
  blocks.some((block) => (block.kind === 'image' && !block.alt?.trim()) || missingAlt(block.blocks ?? []));

export function ArticlesPage() {
  const list = useQuery({ queryKey: listKey, queryFn: () => unwrap(client.GET('/api/admin/articles')) });
  return <Page title="Themenartikel" actions={<Link className="btn btn-primary" to={directory + '/neu'}>Themenartikel anlegen</Link>}>
    {list.isPending ? <Loading /> : !list.data ? <p role="alert">Die Themenartikel konnten nicht geladen werden.</p> :
      list.data.items.length === 0 ? <p>Noch keine Themenartikel vorhanden.</p> :
        <ul className="article-directory">{list.data.items.map(article => <li key={article.id}>
          <Link to={directory + '/' + article.id}>{article.title}</Link>
          <span>{article.status === 'draft' ? 'Entwurf' : 'Veröffentlicht'}</span>
        </li>)}</ul>}
  </Page>;
}

export function ArticleEditorPage() {
  const { id } = useParams();
  const me = useOutletContext<Me>();
  const isNew = id === 'neu';
  const authors = useAuthors();
  const article = useQuery({
    queryKey: detailKey(Number(id)), enabled: !isNew,
    queryFn: () => unwrap(client.GET('/api/admin/articles/{id}', { params: { path: { id: Number(id) } } })),
  });
  if (authors.isPending || (!isNew && article.isPending)) return <Loading />;
  if (!authors.data || (!isNew && !article.data)) return <Page title="Themenartikel"><p role="alert">Der Editor konnte nicht geladen werden.</p></Page>;
  return <Editor key={id} article={isNew ? undefined : article.data} me={me} authors={authors.data} />;
}

function Editor({ article, me, authors }: { article?: Article; me: Me; authors: AuthorOption[] }) {
  const [de, setDe] = useState<Content>(article?.de ?? emptyText());
  const [en, setEn] = useState<Content>(article?.en ?? emptyText());
  const [language, setLanguage] = useState<Language>('de');
  const [authorId, setAuthor] = useState(article?.authorId ?? me.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const location = useLocation();
  // Nach dem ersten Speichern wechselt die Adresse zum neuen Artikel; die Bestätigung reist mit.
  const [notice, setNotice] = useState((location.state as { notice?: string } | null)?.notice ?? '');
  const [invalidTitle, setInvalidTitle] = useState<Language>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const cache = useQueryClient();
  const navigate = useNavigate();
  const content = language === 'de' ? de : en;
  const change = language === 'de' ? setDe : setEn;
  const hasEnglish = Boolean(en.title.trim() || en.subtitle?.trim() || en.blocks.length);
  const status = article?.status ?? 'draft';
  const listLink = <Link to={directory}>Zur Übersicht</Link>;

  // REQ-136-AC14: Ungespeicherte Änderungen nicht stillschweigend verlieren.
  const snapshot = stable({ de, en: hasEnglish ? en : null, authorId });
  const [baseline, setBaseline] = useState(snapshot);
  const dirty = snapshot !== baseline;
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  async function save(nextStatus: Status) {
    const missing = !de.title.trim() ? 'de' : hasEnglish && !en.title.trim() ? 'en' : undefined;
    setError(''); setNotice('');
    if (missing) {
      setInvalidTitle(missing); setLanguage(missing); titleRef.current?.focus(); return;
    }
    setInvalidTitle(undefined);
    const withoutAlt = missingAlt(de.blocks) ? 'de' : hasEnglish && missingAlt(en.blocks) ? 'en' : undefined;
    if (withoutAlt) {
      setLanguage(withoutAlt);
      setError('Bitte für jedes Bild einen Alternativtext eingeben. Er beschreibt das Bild für Menschen, die es nicht sehen.');
      return;
    }
    setBusy(true);
    const body = { de, ...(hasEnglish && { en }), authorId, status: nextStatus };
    try {
      const result = article ? await unwrap(client.PUT('/api/admin/articles/{id}', { params: { path: { id: article.id } }, body })) :
        await unwrap(client.POST('/api/admin/articles', { body }));
      cache.setQueryData(detailKey(result.id), result);
      void cache.invalidateQueries({ queryKey: listKey });
      setBaseline(snapshot);
      if (!article) navigate(directory + '/' + result.id, { replace: true, state: { notice: 'Themenartikel gespeichert.' } });
      else setNotice('Themenartikel gespeichert.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.'); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!article) return;
    setBusy(true); setError('');
    try {
      await unwrap(client.DELETE('/api/admin/articles/{id}', { params: { path: { id: article.id } } }));
      void cache.invalidateQueries({ queryKey: listKey });
      cache.removeQueries({ queryKey: detailKey(article.id), exact:true });
      navigate(directory, { replace:true });
    } catch (err) { setError(err instanceof Error ? err.message : 'Löschen fehlgeschlagen.'); }
    finally { setBusy(false); }
  }
  const submit = (e: FormEvent) => { e.preventDefault(); void save(status); };
  return <Page title={article ? 'Themenartikel bearbeiten' : 'Themenartikel anlegen'} actions={listLink}>
    <form className="article-editor" noValidate onSubmit={submit} onChange={() => setNotice('')}>
      <fieldset disabled={busy} className="article-form-fields"><legend className="visually-hidden">Artikeleinstellungen und Inhalt</legend>
        <div className="article-actions">
          <label>Sprachfassung<select value={language} onChange={e => setLanguage(e.target.value as Language)}>
            <option value="de">Deutsch</option><option value="en">Englisch (optional)</option>
          </select></label>
          <label>Autor<select value={authorId} onChange={e => setAuthor(Number(e.target.value))}>
            {article && (!article.authorActive || !authors.some(a => a.id === article.authorId)) &&
              <option value={article.authorId} disabled>{article.authorLabel} ({article.authorActive ? 'nicht mehr wählbar' : 'deaktiviert'})</option>}
            {authors.filter(a => a.id !== article?.authorId || article.authorActive).map(a =>
              <option key={a.id} value={a.id}>{a.displayName || a.email}</option>)}
          </select></label>
          <label>Layout<select value={content.layout ?? 'column'} onChange={e => {
            const layout = e.target.value as ArticleLayout;
            change({ ...content, layout: layout === 'column' ? undefined : layout });
          }}>
            {LAYOUTS.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
          </select></label>
        </div>
        {article?.topicSlug && <p className="article-address">Öffentliche Adresse: /{language}/themen/{article.topicSlug}</p>}
        <label htmlFor="article-title">Titel</label>
        <input id="article-title" ref={titleRef} aria-invalid={invalidTitle === language} aria-describedby={invalidTitle === language ? 'title-error' : undefined}
          value={content.title} onChange={e => { change({ ...content, title: e.target.value }); setInvalidTitle(undefined); }} />
        {invalidTitle === language && <p id="title-error" role="alert">Bitte einen Titel eingeben.</p>}
        <label>Untertitel<input value={content.subtitle ?? ''} onChange={e => change({ ...content, subtitle: e.target.value })} /></label>
        <ArticleEditor key={language} blocks={content.blocks} layout={content.layout ?? 'column'}
          onChange={blocks => { setNotice(''); change(current => ({ ...current, blocks })); }} onBusy={setBusy} />
        <p>Status · {status === 'draft' ? 'Entwurf' : 'Veröffentlicht'}{dirty && ' · Ungespeicherte Änderungen'}</p>
        <div className="article-actions">
          <button className="btn btn-primary" type="submit">Speichern</button>
          <button type="button" onClick={() => void save(status === 'draft' ? 'published' : 'draft')}>
            {status === 'draft' ? 'Veröffentlichen' : 'Zurücknehmen'}</button>
          {article && <button type="button" onClick={() => setConfirmDelete(true)}>Löschen</button>}
        </div>
        {confirmDelete && <div role="group" aria-label="Löschung bestätigen"><p>Diesen Themenartikel endgültig löschen?</p>
          <div className="article-actions"><button type="button" onClick={() => void remove()}>Endgültig löschen</button>
            <button type="button" onClick={() => setConfirmDelete(false)}>Abbrechen</button></div></div>}
      </fieldset>
      {error && <p role="alert">{error}</p>}
      <p role="status">{notice}</p>
    </form>
  </Page>;
}
