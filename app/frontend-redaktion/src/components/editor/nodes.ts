import { Extension, mergeAttributes, Node, type Editor } from '@tiptap/core';
import type { Node as ProseNode } from '@tiptap/pm/model';
import { Plugin } from '@tiptap/pm/state';

/**
 * Knoten des WYSIWYG-Editors für Themenartikel (Ticket #136). Namen und Aufbau entsprechen lib/articleDoc.ts.
 * Elemente mit festen Feldern (etwa Dachzeile, Überschrift und Inhalt eines Abschnitts) bestehen aus „Slots“:
 * labelSlot für einfachen Text, richSlot für formatierbaren Text und bodySlot für weitere Bausteine.
 */

/** Felder der Elemente in ihrer Reihenfolge. Die Rolle bestimmt Platzhalter und Gestaltung. */
export const SLOT_ROLES: Record<string, string[]> = {
  quote: ['quote', 'source'],
  example: ['label', 'text'],
  section: ['eyebrow', 'heading', 'body'],
  conclusion: ['eyebrow', 'heading', 'body'],
  related: ['label', 'title'],
  quoteHeading: ['text', 'source'],
  cta: ['heading', 'text', 'button'],
};

const PLACEHOLDER: Record<string, string> = {
  quote: 'Zitat', source: 'Zuschreibung (optional)', label: 'Beschriftung', text: 'Text', eyebrow: 'Dachzeile',
  heading: 'Überschrift', title: 'Titel des Verweises', button: 'Text der Schaltfläche',
};
const SLOT_TAG: Record<string, string> = { quote: 'blockquote', source: 'figcaption' };

const Document = Node.create({ name: 'doc', topNode: true, content: '(block | topblock)+' });

const Paragraph = Node.create({
  name: 'paragraph',
  priority: 1000,
  group: 'block',
  content: 'inline*',
  addAttributes() {
    return {
      lead: {
        default: false,
        parseHTML: (el) => el.classList.contains('article-lead'),
        renderHTML: (attrs) => (attrs.lead ? { class: 'article-lead' } : {}),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'p' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['p', HTMLAttributes, 0];
  },
});

/** Überschrift 1 bis 3. Öffentlich erscheinen sie unter dem Artikeltitel als h2 bis h4 (#67). */
const Heading = Node.create({
  name: 'heading',
  group: 'block',
  content: 'text*',
  marks: '',
  defining: true,
  addAttributes() {
    return { level: { default: 1, rendered: false }, anchor: { default: null, rendered: false } };
  },
  parseHTML() {
    return [1, 2, 3].map((level) => ({ tag: `h${level + 1}`, attrs: { level } }));
  },
  renderHTML({ node, HTMLAttributes }) {
    return [`h${Number(node.attrs.level) + 1}`, HTMLAttributes, 0];
  },
});

function slotNode(name: string, content: string, marks?: string) {
  return Node.create({
    name,
    content,
    ...(marks !== undefined && { marks }),
    isolating: true,
    defining: true,
    selectable: false,
    addAttributes() {
      return { role: { default: 'text', parseHTML: (el) => el.getAttribute('data-role'), renderHTML: (attrs) => ({ 'data-role': attrs.role }) } };
    },
    parseHTML() {
      return [{ tag: `[data-slot="${name}"]` }];
    },
    renderHTML({ node, HTMLAttributes }) {
      const role = String(node.attrs.role);
      return [SLOT_TAG[role] ?? 'div', mergeAttributes(HTMLAttributes, { 'data-slot': name, 'data-placeholder': PLACEHOLDER[role] }), 0];
    },
  });
}

const LabelSlot = slotNode('labelSlot', 'text*', '');
const RichSlot = slotNode('richSlot', 'inline*');
const BodySlot = slotNode('bodySlot', 'block+');

function element(name: string, kind: string, tag: string, content: string, group: 'block' | 'topblock', options: { href?: boolean; marks?: string; className?: string } = {}) {
  return Node.create({
    name,
    group,
    content,
    ...(options.marks !== undefined && { marks: options.marks }),
    isolating: true,
    defining: true,
    addAttributes() {
      return {
        anchor: { default: null, rendered: false },
        ...(options.href && { href: { default: null, parseHTML: (el: HTMLElement) => el.getAttribute('data-href'), renderHTML: (attrs: Record<string, unknown>) => (attrs.href ? { 'data-href': attrs.href } : {}) } }),
      };
    },
    parseHTML() {
      return [{ tag: `${tag}[data-kind="${kind}"]` }];
    },
    renderHTML({ HTMLAttributes }) {
      return [tag, mergeAttributes(HTMLAttributes, { 'data-kind': kind, ...(options.className && { class: options.className }) }), 0];
    },
  });
}

const InfoBox = element('infoBox', 'info', 'aside', 'inline*', 'block', { className: 'article-info' });
const Statement = element('statement', 'statement', 'blockquote', 'text*', 'block', { marks: '' });
const Quote = element('quote', 'quote', 'figure', 'richSlot labelSlot', 'block');
const Example = element('example', 'example', 'figure', 'labelSlot richSlot', 'block');
const Section = element('section', 'section', 'section', 'labelSlot labelSlot bodySlot', 'topblock');
const Conclusion = element('conclusion', 'conclusion', 'section', 'labelSlot labelSlot bodySlot', 'topblock');
const Related = element('related', 'related', 'div', 'labelSlot labelSlot', 'block', { href: true });
const QuoteHeading = element('quoteHeading', 'quoteheading', 'div', 'labelSlot labelSlot', 'block');
const Cta = element('cta', 'cta', 'section', 'labelSlot labelSlot labelSlot', 'block', { href: true });

const number = (index: number) => String(index + 1).padStart(2, '0');

/** Nummerierte Abschnitte des Dokuments mit Dachzeile und Überschrift. */
export function sectionsOf(doc: ProseNode) {
  const sections: { eyebrow: string; heading: string }[] = [];
  doc.forEach((node) => {
    if (node.type.name === 'section') sections.push({ eyebrow: node.child(0).textContent.trim(), heading: node.child(1).textContent.trim() });
  });
  return sections;
}

/** Abschnittsübersicht: listet die nummerierten Abschnitte und folgt Änderungen am Dokument. */
const Outline = Node.create({
  name: 'outline',
  group: 'topblock',
  atom: true,
  selectable: true,
  parseHTML() {
    return [{ tag: 'div[data-kind="outline"]' }];
  },
  renderHTML() {
    return ['div', { 'data-kind': 'outline' }];
  },
  addNodeView() {
    return ({ editor }) => {
      const dom = document.createElement('div');
      dom.dataset.kind = 'outline';
      dom.contentEditable = 'false';
      const title = document.createElement('p');
      title.className = 'ed-element-label';
      title.textContent = 'Abschnittsübersicht';
      const list = document.createElement('ol');
      const empty = document.createElement('p');
      empty.className = 'ed-hint';
      empty.textContent = 'Listet die nummerierten Abschnitte dieses Artikels auf, sobald es welche gibt.';
      dom.append(title, list, empty);
      let shown = '';
      const render = () => {
        const sections = sectionsOf(editor.state.doc);
        const key = JSON.stringify(sections);
        if (key === shown) return;
        shown = key;
        empty.hidden = sections.length > 0;
        list.replaceChildren(...sections.map((section, index) => {
          const item = document.createElement('li');
          const no = document.createElement('span');
          no.textContent = number(index);
          const strong = document.createElement('strong');
          strong.textContent = section.eyebrow;
          const small = document.createElement('small');
          small.textContent = section.heading;
          item.append(no, ' ', strong, ' ', small);
          return item;
        }));
      };
      render();
      editor.on('transaction', render);
      return { dom, ignoreMutation: () => true, destroy: () => void editor.off('transaction', render) };
    };
  },
});

/** Bild mit Alternativtext und Bildunterschrift direkt am Bild (REQ-136-AC10). */
const Image = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  selectable: true,
  addAttributes() {
    return { src: { default: '' }, alt: { default: '' }, caption: { default: '' }, width: { default: null }, height: { default: null }, anchor: { default: null } };
  },
  parseHTML() {
    return [{ tag: 'figure[data-kind="image"]' }];
  },
  renderHTML({ node }) {
    return ['figure', { 'data-kind': 'image' }, ['img', { src: node.attrs.src, alt: node.attrs.alt }]];
  },
  addNodeView() {
    return ({ node, getPos, editor }) => {
      let current = node;
      const dom = document.createElement('figure');
      dom.dataset.kind = 'image';
      dom.contentEditable = 'false';
      const img = document.createElement('img');
      const fields = document.createElement('div');
      fields.className = 'ed-image-fields';
      const field = (text: string, key: 'alt' | 'caption', hint: string) => {
        const wrap = document.createElement('label');
        wrap.append(text);
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = hint;
        input.addEventListener('input', () => {
          const pos = getPos();
          if (typeof pos === 'number') editor.view.dispatch(editor.state.tr.setNodeAttribute(pos, key, input.value));
        });
        wrap.append(input);
        fields.append(wrap);
        return input;
      };
      const alt = field('Alternativtext', 'alt', 'Beschreibt das Bild für Menschen, die es nicht sehen');
      const caption = field('Bildunterschrift', 'caption', 'Optional, erscheint unter dem Bild');
      dom.append(img, fields);
      const sync = (next: ProseNode) => {
        current = next;
        if (img.getAttribute('src') !== next.attrs.src) img.src = next.attrs.src;
        img.alt = next.attrs.alt ?? '';
        if (alt.value !== (next.attrs.alt ?? '')) alt.value = next.attrs.alt ?? '';
        if (caption.value !== (next.attrs.caption ?? '')) caption.value = next.attrs.caption ?? '';
        alt.setAttribute('aria-invalid', String(!String(next.attrs.alt ?? '').trim()));
      };
      sync(node);
      return {
        dom,
        update: (next) => {
          if (next.type !== current.type) return false;
          sync(next);
          return true;
        },
        stopEvent: (event) => event.target instanceof HTMLInputElement,
        ignoreMutation: () => true,
      };
    };
  },
});

/** Hält die Rollen der Felder passend zu ihrer Position, auch wenn der Editor ein fehlendes Feld ergänzt. */
const SlotRoles = Extension.create({
  name: 'slotRoles',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction: (transactions, _old, state) => {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          const tr = state.tr;
          state.doc.descendants((node, pos) => {
            const roles = SLOT_ROLES[node.type.name];
            if (!roles) return true;
            let offset = pos + 1;
            node.forEach((child, _offset, index) => {
              if (roles[index] && child.attrs.role !== roles[index]) tr.setNodeAttribute(offset, 'role', roles[index]);
              offset += child.nodeSize;
            });
            return true;
          });
          return tr.docChanged ? tr : null;
        },
      }),
    ];
  },
});

export const articleNodes = [
  Document, Paragraph, Heading, LabelSlot, RichSlot, BodySlot, InfoBox, Statement, Quote, Example, Section, Conclusion,
  Related, QuoteHeading, Cta, Outline, Image, SlotRoles,
];

const slots = (name: string) => SLOT_ROLES[name].map((role) => ({
  type: role === 'body' ? 'bodySlot' : role === 'quote' || (name === 'example' && role === 'text') ? 'richSlot' : 'labelSlot',
  attrs: { role },
  ...(role === 'body' && { content: [{ type: 'paragraph' }] }),
}));

/** Leere Elemente für Werkzeugleiste und Einfügen-Menü. */
export const EMPTY_ELEMENT: Record<string, () => Record<string, unknown>> = {
  quote: () => ({ type: 'quote', content: slots('quote') }),
  infoBox: () => ({ type: 'infoBox' }),
  section: () => ({ type: 'section', content: slots('section') }),
  outline: () => ({ type: 'outline' }),
  example: () => ({ type: 'example', content: slots('example') }),
  statement: () => ({ type: 'statement' }),
  conclusion: () => ({ type: 'conclusion', content: slots('conclusion') }),
  related: () => ({ type: 'related', content: slots('related') }),
  quoteHeading: () => ({ type: 'quoteHeading', content: slots('quoteHeading') }),
  cta: () => ({ type: 'cta', content: slots('cta') }),
};

export type ArticleEditorInstance = Editor;
