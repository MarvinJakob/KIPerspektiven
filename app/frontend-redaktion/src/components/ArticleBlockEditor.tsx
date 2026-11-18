import { useState } from 'react';
import { client, unwrap } from '../api/client';
import type { components } from '../api/schema';

type Block = components['schemas']['ArticleBlock'];
type Kind = Block['kind'];
const labels: Record<Kind, string> = {
  paragraph: 'Absatz', h1: 'Überschrift H1', h2: 'Überschrift H2', h3: 'Überschrift H3',
  image: 'Bild oder Grafik', info: 'Infobox', quote: 'Zitat', ordered: 'Nummerierte Liste', unordered: 'Aufzählung',
};

function ListEntries({ block, change }: { block: Block; change: (block: Block) => void }) {
  const items = block.items ?? [];
  const update = (index: number, field: 'title' | 'description', value: string) => {
    change({ ...block, items: items.map((item, i) => i === index ? { ...item, [field]: value } : item) });
  };
  return <>{items.map((entry, index) => <fieldset key={index}>
    <legend>Eintrag {index + 1}</legend>
    <label>Eintragstitel<input value={entry.title} onChange={e => update(index, 'title', e.target.value)} /></label>
    <label>Kurzbeschreibung<input value={entry.description ?? ''} onChange={e => update(index, 'description', e.target.value)} /></label>
    <button type="button" onClick={() => change({ ...block, items: items.filter((_, i) => i !== index) })}>Eintrag entfernen</button>
  </fieldset>)}
    <button type="button" onClick={() => change({ ...block, items: [...items, { title: '' }] })}>Eintrag hinzufügen</button>
  </>;
}

export function ArticleBlockEditor({ blocks, onChange, onBusy }: {
  blocks: Block[]; onChange: (blocks: Block[]) => void; onBusy: (busy: boolean) => void;
}) {
  const [kind, setKind] = useState<Kind>('paragraph');
  const [error, setError] = useState('');
  const replace = (index: number, block: Block) => onChange(blocks.map((b, i) => i === index ? block : b));
  const move = (index: number, delta: number) => {
    const next = blocks.slice();
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onChange(next);
  };
  async function upload(index: number, file?: File) {
    if (!file) return;
    setError('');
    onBusy(true);
    try {
      const image = await unwrap(client.PUT('/api/admin/articles/media', {
        body: { file: file.name }, bodySerializer: () => {
          const data = new FormData();
          data.append('file', file);
          return data;
        },
      }));
      replace(index, { ...blocks[index], src: image.src });
    } catch (err) { setError(err instanceof Error ? err.message : 'Bild konnte nicht hochgeladen werden.'); }
    finally { onBusy(false); }
  }
  return <section className="article-block-editor" aria-label="Artikelinhalt">
    <h2>Artikelinhalt</h2>
    {blocks.map((block, index) => <fieldset key={index + '-' + block.kind}>
      <legend>{index + 1}. {labels[block.kind]}</legend>
      {block.kind === 'image' ? <>
        <label>Bilddatei<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => {
          const file = e.target.files?.[0];
          e.target.value = '';
          void upload(index, file);
        }} /></label>
        {block.src && <img className="article-image-preview" src={block.src} alt={block.alt || 'Bildvorschau'} />}
        <label>Alternativtext<input value={block.alt ?? ''} onChange={e => replace(index, { ...block, alt: e.target.value })} /></label>
        <label>Bildunterschrift<input value={block.caption ?? ''} onChange={e => replace(index, { ...block, caption: e.target.value })} /></label>
      </> : block.kind === 'ordered' || block.kind === 'unordered' ?
        <ListEntries block={block} change={next => replace(index, next)} /> :
        <><label>Text<textarea rows={3} value={block.text ?? ''} onChange={e => replace(index, { ...block, text: e.target.value })} /></label>
          {block.kind === 'quote' && <label>Zuschreibung<input value={block.attribution ?? ''} onChange={e => replace(index, { ...block, attribution: e.target.value })} /></label>}
        </>}
      <div className="article-actions">
        <button type="button" disabled={index === 0} onClick={() => move(index, -1)}>Nach oben</button>
        <button type="button" disabled={index === blocks.length - 1} onClick={() => move(index, 1)}>Nach unten</button>
        <button type="button" onClick={() => onChange(blocks.filter((_, i) => i !== index))}>Entfernen</button>
      </div>
    </fieldset>)}
    {error && <p role="alert">{error}</p>}
    <div className="article-actions">
      <div><label htmlFor="article-block-kind">Baustein</label>
        <select id="article-block-kind" value={kind} onChange={e => setKind(e.target.value as Kind)}>
          {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <button type="button" onClick={() => onChange([...blocks, kind === 'ordered' || kind === 'unordered' ?
        { kind, items: [{ title: '' }] } : { kind }])}>Baustein hinzufügen</button>
    </div>
  </section>;
}
