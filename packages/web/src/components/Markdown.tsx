import { isValidElement, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import s from './Markdown.module.css';

/** A heading's text as a page anchor, the way GitHub makes them: "Turn on background runs" becomes turn-on-background-runs. */
export function headingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return '';
}

const BLANK = { target: '_blank', rel: 'noopener noreferrer' } as const;

// Heading levels shift down by one, as in the prototype (# renders as h2), so the page keeps a single h1.
// Raw HTML is never enabled (no rehype-raw), and images are shown as links so nothing loads on its own.
const components: Components = {
  h1: ({ node: _n, ...p }) => <h2 {...p} />,
  h2: ({ node: _n, ...p }) => <h3 id={headingId(textOf(p.children))} {...p} />,
  h3: ({ node: _n, ...p }) => <h4 id={headingId(textOf(p.children))} {...p} />,
  a: ({ node: _n, href, children }) => (
    <a href={href} {...BLANK}>
      {children}
    </a>
  ),
  img: ({ node: _n, src, alt }) => {
    const url = typeof src === 'string' ? src : '';
    return (
      <a href={url} {...BLANK}>
        🖼 {alt || url}
      </a>
    );
  },
};

/** Renders Markdown in the board's typography (prototype Markdown.dc.html), with GitHub-flavoured extras. */
export function Markdown({ md, size = 'md', mapLink }: { md: string; size?: 'sm' | 'md'; mapLink?: (href: string) => string | null }) {
  const empty = md.trim() === '';
  const parts: Components = !mapLink
    ? components
    : {
        ...components,
        a: ({ node: _n, href, children }) => {
          // A mapped link stays in this tab; anything else opens a new one, as usual.
          const mapped = href ? mapLink(href) : null;
          return mapped !== null ? (
            <a href={mapped}>{children}</a>
          ) : (
            <a href={href} {...BLANK}>
              {children}
            </a>
          );
        },
      };
  return (
    <div className={s.root} data-size={size}>
      {empty ? (
        <p className={s.empty}>Nothing here yet.</p>
      ) : (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={parts}>
          {md}
        </ReactMarkdown>
      )}
    </div>
  );
}
