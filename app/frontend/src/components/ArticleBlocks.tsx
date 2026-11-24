import { useId, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { components } from '../api/schema';
import { safeHref } from '../lib/articleText';
import { jumpTo } from '../lib/jump';
import { Icon } from './Icon';
import '../pages/VibeCoding.css';

type Block = components['schemas']['ArticleBlock'];
type Span = components['schemas']['ArticleSpan'];
export type ArticleLayout = NonNullable<components['schemas']['ArticleText']['layout']>;

/** Nummerierter Abschnitt mit Sprungziel und laufender Nummer. */
interface Numbered {
  id: string;
  number: string;
  block: Block;
}

interface Context {
  /** Grafiken auf heller Fläche (#41): im breiten Lesefluss, im Magazin und in Abschnitten. */
  framed: boolean;
  sections: Numbered[];
}

/** Interner Pfad über den Router, alles andere als gewöhnlicher Link. */
function Anchor({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return href.startsWith('/') ? (
    <Link className={className} to={href}>{children}</Link>
  ) : (
    <a className={className} href={href} rel="noopener noreferrer">{children}</a>
  );
}

/** Text mit Formatierungsbereichen (REQ-136-AC8). Positionen zählen UTF-16-Codeeinheiten wie JavaScript-Strings. */
function Rich({ text = '', spans }: { text?: string; spans?: Span[] }) {
  if (!spans?.length) return <>{text}</>;
  const parts: ReactNode[] = [];
  let at = 0;
  spans.forEach((span, i) => {
    if (span.start < at || span.end <= span.start || span.end > text.length) return;
    if (span.start > at) parts.push(text.slice(at, span.start));
    let node: ReactNode = text.slice(span.start, span.end);
    if (span.underline) node = <u>{node}</u>;
    if (span.italic) node = <em>{node}</em>;
    if (span.bold) node = <strong>{node}</strong>;
    const href = span.href && safeHref(span.href);
    parts.push(href ? <Anchor key={i} href={href}>{node}</Anchor> : <span key={i}>{node}</span>);
    at = span.end;
  });
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts}</>;
}

function Example({ block }: { block: Block }) {
  const generated = useId();
  const caption = `${block.anchor ?? generated}-caption`;
  return (
    <figure className="vc-example" aria-labelledby={block.label ? caption : undefined}>
      {block.label && <figcaption id={caption}>{block.label}</figcaption>}
      <p><em><Rich text={block.text} spans={block.spans} /></em></p>
    </figure>
  );
}

function Opinion({ block }: { block: Block }) {
  const generated = useId();
  const title = `${block.anchor ?? generated}-title`;
  const href = safeHref(block.href ?? '');
  return (
    <section className="opinion" id={block.anchor} aria-labelledby={title}>
      <svg className="opinion-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" aria-hidden="true">
        <path d="M4 5h16v11H9l-5 4V5Z" />
      </svg>
      <div>
        <h2 id={title}>{block.text}</h2>
        {block.description && <p>{block.description}</p>}
      </div>
      {href && block.label && (
        <Anchor className="btn opinion-button press" href={href}>
          {block.label} <Icon name="arrowRight" />
        </Anchor>
      )}
    </section>
  );
}

function ContentBlock({ block, ctx }: { block: Block; ctx: Context }) {
  switch (block.kind) {
    case 'paragraph': return <p><Rich text={block.text} spans={block.spans} /></p>;
    case 'lead': return <p className="article-lead"><Rich text={block.text} spans={block.spans} /></p>;
    case 'h1': return <h2 id={block.anchor}>{block.text}</h2>;
    case 'h2': return <h3 id={block.anchor}>{block.text}</h3>;
    case 'h3': return <h4 id={block.anchor}>{block.text}</h4>;
    case 'info': return <aside className="article-info"><Rich text={block.text} spans={block.spans} /></aside>;
    case 'image': return (
      <figure className={ctx.framed ? 'article-figure' : undefined}>
        <img src={block.src} alt={block.alt} width={block.width} height={block.height} loading="lazy" />
        {block.caption && <figcaption>{block.caption}</figcaption>}
      </figure>
    );
    case 'quote': return (
      <figure className="article-quotation">
        <blockquote><Rich text={block.text} spans={block.spans} /></blockquote>
        {block.attribution && <figcaption>{block.attribution}</figcaption>}
      </figure>
    );
    case 'ordered':
    case 'unordered': {
      const List = block.kind === 'ordered' ? 'ol' : 'ul';
      return (
        <List>
          {block.items?.map((item, index) => (
            <li key={index}>
              <strong><Rich text={item.title} spans={item.spans} /></strong>
              {item.description && <p><Rich text={item.description} spans={item.descriptionSpans} /></p>}
            </li>
          ))}
        </List>
      );
    }
    case 'example': return <Example block={block} />;
    case 'statement': return <blockquote className="vc-quote"><p>{block.text}</p></blockquote>;
    case 'outline': return (
      <ol className="vc-index">
        {ctx.sections.map(({ id, number, block: section }) => (
          <li key={id}>
            <a href={`#${id}`} onClick={(e) => jumpTo(e, id)}>
              <span>{number}</span>
              <strong>{section.eyebrow}<small>{section.text}</small></strong>
            </a>
          </li>
        ))}
      </ol>
    );
    case 'related': {
      const href = safeHref(block.href ?? '');
      if (!href) return null;
      return (
        <Anchor className="related-link" href={href}>
          <span className="related-label">{block.label}</span>
          <span className="related-title">{block.text}</span>
          <Icon name="arrowRight" />
        </Anchor>
      );
    }
    case 'quoteheading': return (
      <h2 id={block.anchor} className="quote-heading">
        <span className="quote-mark" aria-hidden="true">“</span>
        {block.text}
        {block.attribution && <small>{block.attribution}</small>}
      </h2>
    );
    case 'cta': return <Opinion block={block} />;
    default: return null;
  }
}

const Blocks = ({ blocks, ctx }: { blocks: Block[]; ctx: Context }) =>
  blocks.map((block, index) => <ContentBlock key={index} block={block} ctx={ctx} />);

/** Nummerierter Abschnitt nach dem Vorbild der Perspektiven in „Vibe Coding“ (#18). */
function Perspective({ section, ctx }: { section: Numbered; ctx: Context }) {
  const { id, number, block } = section;
  return (
    <section className="container vc-split vc-perspective" id={id} tabIndex={-1} aria-labelledby={`${id}-title`}>
      <header className="vc-split-head">
        <span className="vc-number" aria-hidden="true">{number}</span>
        {block.eyebrow && <p className="eyebrow">{block.eyebrow}</p>}
        <h2 id={`${id}-title`}>{block.text}</h2>
      </header>
      <div className="vc-body"><Blocks blocks={block.blocks ?? []} ctx={{ ...ctx, framed: true }} /></div>
    </section>
  );
}

function Conclusion({ block, ctx }: { block: Block; ctx: Context }) {
  const generated = useId();
  const title = `${block.anchor ?? generated}-title`;
  return (
    <section className="container vc-split vc-conclusion" aria-labelledby={title}>
      <header className="vc-split-head">
        {block.eyebrow && <p className="eyebrow">{block.eyebrow}</p>}
        <h2 id={title}>{block.text}</h2>
      </header>
      <div className="vc-body"><Blocks blocks={block.blocks ?? []} ctx={{ ...ctx, framed: true }} /></div>
    </section>
  );
}

/**
 * Breiter Lesefluss (#57, #66): Jede Zwischenüberschrift, jede Grafik und der Aufruf beginnen einen Abschnitt.
 * Der Abstand zwischen den Abschnitten gliedert den Artikel wie in „KI in der Softwareentwicklung“.
 */
function WideFlow({ blocks, ctx }: { blocks: Block[]; ctx: Context }) {
  const parts: Block[][] = [];
  for (const block of blocks) {
    const starts = ['h1', 'quoteheading', 'image', 'cta'].includes(block.kind);
    if (starts || !parts.length || parts[parts.length - 1][0].kind === 'cta') parts.push([]);
    parts[parts.length - 1].push(block);
  }
  return (
    <div className="container article-layout">
      <div className="article-body">
        {parts.map((part, index) => {
          const [first] = part;
          if (first.kind === 'cta') return <Opinion key={index} block={first} />;
          const labelled = first.kind === 'h1' || first.kind === 'quoteheading';
          return (
            <section key={index} id={labelled ? undefined : first.anchor} aria-labelledby={labelled ? first.anchor : undefined}>
              <Blocks blocks={part} ctx={ctx} />
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Flow({ layout, blocks, ctx }: { layout: ArticleLayout; blocks: Block[]; ctx: Context }) {
  if (layout === 'wide') return <WideFlow blocks={blocks} ctx={ctx} />;
  if (layout === 'magazine') {
    return (
      <section className="container vc-intro">
        <div className="vc-reading"><Blocks blocks={blocks} ctx={ctx} /></div>
      </section>
    );
  }
  return <div className="article prose managed-article"><Blocks blocks={blocks} ctx={ctx} /></div>;
}

type Group = { kind: 'flow'; blocks: Block[] } | { kind: 'sections'; sections: Numbered[] } | { kind: 'conclusion'; block: Block };

/**
 * Inhalt eines Themenartikels (#67, #136). Fließinhalt erscheint im gewählten Layout; nummerierte Abschnitte stehen
 * in jedem Layout gemeinsam auf abgesetzter Fläche, die Fazit-Box als eigener Kasten.
 */
export function ArticleBlocks({ blocks, layout = 'column' }: { blocks: Block[]; layout?: ArticleLayout }) {
  const sections: Numbered[] = [];
  const groups: Group[] = [];
  for (const block of blocks) {
    const last = groups[groups.length - 1];
    if (block.kind === 'section') {
      const n = sections.length + 1;
      const numbered = { id: block.anchor ?? `teil-${n}`, number: String(n).padStart(2, '0'), block };
      sections.push(numbered);
      if (last?.kind === 'sections') last.sections.push(numbered);
      else groups.push({ kind: 'sections', sections: [numbered] });
    } else if (block.kind === 'conclusion') groups.push({ kind: 'conclusion', block });
    else if (last?.kind === 'flow') last.blocks.push(block);
    else groups.push({ kind: 'flow', blocks: [block] });
  }
  const ctx: Context = { framed: layout !== 'column', sections };
  return (
    <>
      {groups.map((group, index) => {
        if (group.kind === 'flow') return <Flow key={index} layout={layout} blocks={group.blocks} ctx={ctx} />;
        if (group.kind === 'conclusion') return <Conclusion key={index} block={group.block} ctx={ctx} />;
        return (
          <div key={index} className="vc-perspectives">
            {group.sections.map((section) => <Perspective key={section.id} section={section} ctx={ctx} />)}
          </div>
        );
      })}
    </>
  );
}
