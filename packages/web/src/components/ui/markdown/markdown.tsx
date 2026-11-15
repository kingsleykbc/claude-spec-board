import { isValidElement, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

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

// The board's Markdown typography. The parts are rendered by react-markdown, so they are
// styled from the root. Lists say their own markers and links their underline, since the reset removes them: disc,
// then circle, then square, as browsers nest them.
const root = [
  'flex flex-col gap-2.5 text-[15px] leading-[1.65] text-fg text-pretty data-[size=sm]:text-[14px]',
  '[&_p]:m-0 [&_strong]:font-semibold [&_a]:underline',
  '[&_h2]:mx-0 [&_h2]:mt-1 [&_h2]:mb-0 [&_h2]:text-[20px] [&_h2]:leading-[1.3] [&_h2]:font-semibold [&_h2]:tracking-[-0.01em]',
  '[&_h3]:mx-0 [&_h3]:mt-2.5 [&_h3]:mb-[-2px] [&_h3]:text-[11.5px] [&_h3]:font-semibold [&_h3]:tracking-[0.09em] [&_h3]:text-fg2 [&_h3]:uppercase',
  '[&_h4]:mx-0 [&_h4]:mt-1.5 [&_h4]:mb-[-4px] [&_h4]:text-[14px] [&_h4]:leading-[inherit] [&_h4]:font-semibold',
  '[&_:is(ul,ol)]:m-0 [&_:is(ul,ol)]:flex [&_:is(ul,ol)]:flex-col [&_:is(ul,ol)]:gap-1 [&_:is(ul,ol)]:pl-5 [&_li]:pl-0.5',
  '[&_ul]:list-disc [&_:is(ul,ol)_ul]:list-[circle] [&_:is(ul,ol)_:is(ul,ol)_ul]:list-[square] [&_ol]:list-decimal',
  '[&_code]:rounded [&_code]:border [&_code]:border-line [&_code]:bg-code [&_code]:px-[5px] [&_code]:py-px [&_code]:font-mono [&_code]:text-[0.86em]',
  '[&_pre]:m-0 [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-line [&_pre]:bg-code [&_pre]:px-3.5 [&_pre]:py-3 [&_pre]:font-mono [&_pre]:text-[12.5px] [&_pre]:leading-[1.6] [&_pre]:whitespace-pre',
  '[&_pre_code]:rounded-none [&_pre_code]:border-0 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:[font-size:inherit]',
  '[&_table]:border-collapse [&_table]:text-[0.92em]',
  '[&_:is(th,td)]:border [&_:is(th,td)]:border-line [&_:is(th,td)]:px-[9px] [&_:is(th,td)]:py-1 [&_:is(th,td)]:text-left',
].join(' ');

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
    <div className={root} data-size={size}>
      {empty ? (
        <p className="text-fg3">Nothing here yet.</p>
      ) : (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={parts}>
          {md}
        </ReactMarkdown>
      )}
    </div>
  );
}
