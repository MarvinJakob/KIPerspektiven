import type { components } from '../api/schema';

type Block = components['schemas']['ArticleBlock'];

function ContentBlock({ block }: { block: Block }) {
  switch (block.kind) {
    case 'paragraph': return <p>{block.text}</p>;
    case 'h1': return <h2>{block.text}</h2>;
    case 'h2': return <h3>{block.text}</h3>;
    case 'h3': return <h4>{block.text}</h4>;
    case 'info': return <aside className="article-info">{block.text}</aside>;
    case 'image': return <figure><img src={block.src} alt={block.alt} loading="lazy" />
      {block.caption && <figcaption>{block.caption}</figcaption>}</figure>;
    case 'quote': return <figure className="article-quotation"><blockquote>{block.text}</blockquote>
      {block.attribution && <figcaption>{block.attribution}</figcaption>}</figure>;
    case 'ordered':
    case 'unordered': {
      const List = block.kind === 'ordered' ? 'ol' : 'ul';
      return <List>{block.items?.map((item, index) => <li key={index}><strong>{item.title}</strong>
        {item.description && <p>{item.description}</p>}</li>)}</List>;
    }
  }
}

export function ArticleBlocks({ blocks }: { blocks: Block[] }) {
  return <div className="article prose managed-article">{blocks.map((block, index) =>
    <ContentBlock key={index} block={block} />)}</div>;
}
