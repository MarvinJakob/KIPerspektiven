import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import { Selection } from '@tiptap/pm/state';
import type { ResolvedPos } from '@tiptap/pm/model';
import StarterKit from '@tiptap/starter-kit';
import { client, unwrap } from '../api/client';
import type { components } from '../api/schema';
import { blocksToDoc, docToBlocks, type DocNode } from '../lib/articleDoc';
import { HREF_HINT, normalizeHref } from '../lib/links';
import { articleNodes, EMPTY_ELEMENT } from './editor/nodes';
import './ArticleEditor.css';

type Block = components['schemas']['ArticleBlock'];
export type ArticleLayout = NonNullable<components['schemas']['ArticleText']['layout']>;

const STYLES = [
  ['paragraph', 'Absatz'], ['lead', 'Einleitung'], ['h1', 'Überschrift 1'], ['h2', 'Überschrift 2'], ['h3', 'Überschrift 3'],
] as const;
const ELEMENTS = [
  ['section', 'Nummerierter Abschnitt'], ['outline', 'Abschnittsübersicht'], ['example', 'Beispielkasten'], ['statement', 'Kernaussage'],
  ['conclusion', 'Fazit-Box'], ['related', 'Verweis'], ['quoteHeading', 'Zitatüberschrift'], ['cta', 'Aufruf'],
] as const;
/** Elemente, die nur auf der obersten Ebene des Artikels stehen. */
const TOP_ONLY = new Set(['section', 'conclusion', 'outline']);
/** Elemente mit einem Ziel statt eines Links im Text. */
const TARGET_NODES = ['related', 'cta'];

const extensions = [
  StarterKit.configure({
    document: false, paragraph: false, heading: false, blockquote: false, code: false, codeBlock: false, strike: false, horizontalRule: false,
    link: { openOnClick: false, autolink: false, linkOnPaste: false, HTMLAttributes: { rel: null, target: null }, isAllowedUri: (url) => normalizeHref(url ?? '') !== null },
  }),
  ...articleNodes,
];

/** Tiefe des Bausteins an der Schreibmarke: Kind des Dokuments oder des Inhalts eines Abschnitts. */
function blockDepth($pos: ResolvedPos, topOnly = false): number {
  if (!topOnly) {
    for (let depth = $pos.depth; depth > 1; depth--) {
      if ($pos.node(depth - 1).type.name === 'bodySlot') return depth;
    }
  }
  return Math.min(1, $pos.depth);
}

/** Fügt ein Element nach dem aktuellen Baustein ein (ein leerer Absatz wird ersetzt) und setzt die Schreibmarke hinein. */
function insertElement(editor: Editor, json: Record<string, unknown>) {
  const { state, view } = editor;
  const { $from } = state.selection;
  const node = state.schema.nodeFromJSON(json);
  const depth = blockDepth($from, TOP_ONLY.has(node.type.name));
  const tr = state.tr;
  let pos: number;
  if (depth === 0) {
    pos = state.selection.to;
    tr.insert(pos, node);
  } else {
    const current = $from.node(depth);
    if (current.type.name === 'paragraph' && current.content.size === 0) {
      pos = $from.before(depth);
      tr.replaceWith(pos, $from.after(depth), node);
    } else {
      pos = $from.after(depth);
      tr.insert(pos, node);
    }
  }
  tr.setSelection(Selection.near(tr.doc.resolve(Math.min(pos + 1, tr.doc.content.size))));
  view.dispatch(tr.scrollIntoView());
  view.focus();
}

function removeElement(editor: Editor) {
  const { state, view } = editor;
  const { $from } = state.selection;
  const depth = blockDepth($from);
  const tr = depth === 0 ? state.tr.deleteSelection() : state.tr.delete($from.before(depth), $from.after(depth));
  view.dispatch(tr.scrollIntoView());
  view.focus();
}

/** Verweis oder Aufruf, in dem die Schreibmarke steht. */
function targetNode(editor: Editor) {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (TARGET_NODES.includes(node.type.name)) return { node, pos: $from.before(depth) };
  }
  return null;
}

function currentStyle(editor: Editor): string {
  if (editor.isActive('heading')) return `h${editor.getAttributes('heading').level}`;
  const parent = editor.state.selection.$from.parent;
  if (parent.type.name !== 'paragraph') return '';
  return parent.attrs.lead ? 'lead' : 'paragraph';
}

function setStyle(editor: Editor, style: string) {
  const chain = editor.chain().focus();
  if (style.startsWith('h')) chain.setNode('heading', { level: Number(style[1]) }).run();
  else chain.setNode('paragraph', { lead: style === 'lead' }).run();
}

const ICONS: Record<string, ReactNode> = {
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  image: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m4 18 5-5 4 4 3-3 4 4" /></>,
  bullet: <><path d="M9 7h11M9 12h11M9 17h11" /><circle cx="4.5" cy="7" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="17" r="1" /></>,
  ordered: <><path d="M10 7h10M10 12h10M10 17h10" /><path d="M4 5.5 5.2 5v4M3.8 14.2c.4-.9 2.3-.8 2.2.4 0 .8-1.3 1.3-2.2 2.4H6.2" /></>,
  quote: <path d="M5 17c2-1 3-3 3-5H5V7h5v5c0 3-1.5 5-4 6l-1-1Zm9 0c2-1 3-3 3-5h-3V7h5v5c0 3-1.5 5-4 6l-1-1Z" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.01" /></>,
  remove: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  undo: <path d="M8 6 4 10l4 4M4 10h10a6 6 0 0 1 0 12h-3" />,
  redo: <path d="m16 6 4 4-4 4M20 10H10a6 6 0 0 0 0 12h3" />,
};

function Tool({ name, icon, glyph, pressed, shortcut, disabled, onClick }: {
  name: string; icon?: string; glyph?: string; pressed?: boolean; shortcut?: string; disabled?: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="tb-btn"
      aria-label={name}
      aria-pressed={pressed}
      title={shortcut ? `${name} (${shortcut})` : name}
      data-glyph={glyph}
      disabled={disabled}
      // Die Schreibmarke bleibt beim Klick im Text; die Tastatur erreicht die Schaltfläche weiterhin.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {icon && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[icon]}</svg>}
      <span className="visually-hidden">{name}</span>
    </button>
  );
}

/**
 * WYSIWYG-Editor für den Inhalt eines Themenartikels (Ticket #136) mit Werkzeugleiste am oberen Rand.
 * Gespeichert werden weiterhin Bausteine; der Editor meldet sie bei jeder Änderung über `onChange`.
 */
export function ArticleEditor({ blocks, layout, onChange, onBusy }: {
  blocks: Block[]; layout: ArticleLayout; onChange: (blocks: Block[]) => void; onBusy: (busy: boolean) => void;
}) {
  const ids = { href: useId(), error: useId() };
  const file = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState<{ value: string; error: string; target: boolean } | null>(null);
  const [uploadError, setUploadError] = useState('');
  const changed = useRef(onChange);
  changed.current = onChange;

  const editor = useEditor({
    extensions,
    content: blocksToDoc(blocks),
    editorProps: { attributes: { 'aria-label': 'Artikelinhalt', 'aria-multiline': 'true', class: `article-doc article-doc--${layout}` } },
    onUpdate: ({ editor: e }) => changed.current(docToBlocks(e.getJSON() as DocNode)),
  });

  useEffect(() => {
    editor.setOptions({ editorProps: { attributes: { 'aria-label': 'Artikelinhalt', 'aria-multiline': 'true', class: `article-doc article-doc--${layout}` } } });
  }, [editor, layout]);

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'), italic: e.isActive('italic'), underline: e.isActive('underline'), link: e.isActive('link') || Boolean(targetNode(e)),
      bullet: e.isActive('bulletList'), ordered: e.isActive('orderedList'), quote: e.isActive('quote'), info: e.isActive('infoBox'),
      style: currentStyle(e), canUndo: e.can().undo(), canRedo: e.can().redo(),
    }),
  });

  const openLink = () => {
    const target = targetNode(editor);
    if (target) return setLink({ value: target.node.attrs.href ?? '', error: '', target: true });
    const href = editor.getAttributes('link').href as string | undefined;
    if (!href && editor.state.selection.empty) return setLink({ value: '', error: 'Bitte zuerst den Text markieren, der zum Link werden soll.', target: false });
    setLink({ value: href ?? '', error: '', target: false });
  };

  const applyLink = () => {
    if (!link) return;
    const href = normalizeHref(link.value);
    if (!href) return setLink({ ...link, error: HREF_HINT });
    const target = targetNode(editor);
    if (target) editor.view.dispatch(editor.state.tr.setNodeAttribute(target.pos, 'href', href));
    else if (editor.state.selection.empty && !editor.isActive('link')) return setLink({ ...link, error: 'Bitte zuerst den Text markieren, der zum Link werden soll.' });
    else editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    setLink(null);
    editor.commands.focus();
  };

  const removeLink = () => {
    const target = targetNode(editor);
    if (target) editor.view.dispatch(editor.state.tr.setNodeAttribute(target.pos, 'href', null));
    else editor.chain().focus().extendMarkRange('link').unsetLink().run();
    setLink(null);
    editor.commands.focus();
  };

  async function upload(picked?: File) {
    if (!picked) return;
    setUploadError('');
    onBusy(true);
    try {
      const image = await unwrap(client.PUT('/api/admin/articles/media', {
        body: { file: picked.name },
        bodySerializer: () => {
          const data = new FormData();
          data.append('file', picked);
          return data;
        },
      }));
      insertElement(editor, { type: 'image', attrs: { src: image.src, width: image.width ?? null, height: image.height ?? null } });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Das Bild konnte nicht hochgeladen werden.');
    } finally {
      onBusy(false);
    }
  }

  // Der Fokus kehrt sofort in den Text zurück, damit nach Tastaturbedienung der Leiste kein Zeichen verloren geht.
  const toggle = (run: (chain: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) => () => {
    editor.view.focus();
    run(editor.chain()).run();
  };

  return (
    <section className="article-wysiwyg" aria-label="Artikelinhalt bearbeiten">
      <div className="tb-sticky">
        <div className="tb" role="toolbar" aria-label="Formatierung">
          <select className="tb-select" aria-label="Stil" value={state.style} disabled={!state.style} onChange={(e) => setStyle(editor, e.target.value)}>
            {!state.style && <option value="">Stil</option>}
            {STYLES.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
          </select>
          <span className="tb-sep" aria-hidden="true" />
          <Tool name="Fett" glyph="B" shortcut="Strg+B" pressed={state.bold} onClick={toggle((c) => c.toggleBold())} />
          <Tool name="Kursiv" glyph="I" shortcut="Strg+I" pressed={state.italic} onClick={toggle((c) => c.toggleItalic())} />
          <Tool name="Unterstrichen" glyph="U" shortcut="Strg+U" pressed={state.underline} onClick={toggle((c) => c.toggleUnderline())} />
          <span className="tb-sep" aria-hidden="true" />
          <Tool name="Link" icon="link" pressed={state.link} onClick={() => (link ? setLink(null) : openLink())} />
          <Tool name="Bild" icon="image" onClick={() => file.current?.click()} />
          <span className="tb-sep" aria-hidden="true" />
          <Tool name="Aufzählung" icon="bullet" pressed={state.bullet} onClick={toggle((c) => c.toggleBulletList())} />
          <Tool name="Nummerierte Liste" icon="ordered" pressed={state.ordered} onClick={toggle((c) => c.toggleOrderedList())} />
          <Tool name="Zitat" icon="quote" pressed={state.quote} onClick={() => insertElement(editor, EMPTY_ELEMENT.quote())} />
          <Tool name="Infobox" icon="info" pressed={state.info} onClick={() => insertElement(editor, EMPTY_ELEMENT.infoBox())} />
          <span className="tb-sep" aria-hidden="true" />
          <select
            className="tb-select"
            aria-label="Element einfügen"
            value=""
            onChange={(e) => {
              const create = EMPTY_ELEMENT[e.target.value];
              if (create) insertElement(editor, create());
            }}
          >
            <option value="">Einfügen …</option>
            {ELEMENTS.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
          </select>
          <Tool name="Element entfernen" icon="remove" onClick={() => removeElement(editor)} />
          <span className="tb-sep" aria-hidden="true" />
          <Tool name="Rückgängig" icon="undo" shortcut="Strg+Z" disabled={!state.canUndo} onClick={toggle((c) => c.undo())} />
          <Tool name="Wiederholen" icon="redo" shortcut="Strg+Umschalt+Z" disabled={!state.canRedo} onClick={toggle((c) => c.redo())} />
        </div>
        {link && (
          <div className="tb-link" role="group" aria-label={link.target ? 'Ziel des Elements' : 'Link'}>
            <label htmlFor={ids.href}>Linkadresse</label>
            <input
              id={ids.href}
              type="text"
              inputMode="url"
              autoFocus
              value={link.value}
              placeholder="https://… oder /de/…"
              aria-invalid={Boolean(link.error)}
              aria-describedby={link.error ? ids.error : undefined}
              onChange={(e) => setLink({ ...link, value: e.target.value, error: '' })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applyLink();
                } else if (e.key === 'Escape') {
                  setLink(null);
                  editor.commands.focus();
                }
              }}
            />
            <button type="button" className="btn btn-primary btn-small" onClick={applyLink}>Link übernehmen</button>
            <button type="button" className="btn btn-secondary btn-small" onClick={removeLink}>Link entfernen</button>
            <button type="button" className="btn btn-secondary btn-small" onClick={() => { setLink(null); editor.commands.focus(); }}>Abbrechen</button>
            {link.error && <p id={ids.error} role="alert">{link.error}</p>}
          </div>
        )}
        {uploadError && <p className="tb-error" role="alert">{uploadError}</p>}
      </div>
      <input
        ref={file}
        hidden
        type="file"
        aria-label="Bilddatei"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          const picked = e.target.files?.[0];
          e.target.value = '';
          void upload(picked);
        }}
      />
      <EditorContent editor={editor} />
    </section>
  );
}
