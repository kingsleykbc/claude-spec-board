import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import s from './Markdown.module.css';

const BLANK = { target: '_blank', rel: 'noopener noreferrer' } as const;

// Heading levels shift down by one, as in the prototype (# renders as h2), so the page keeps a single h1.
// Raw HTML is never enabled (no rehype-raw), and images are shown as links so nothing loads on its own.
const components: Components = {
  h1: ({ node: _n, ...p }) => <h2 {...p} />,
  h2: ({ node: _n, ...p }) => <h3 {...p} />,
  h3: ({ node: _n, ...p }) => <h4 {...p} />,
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
export function Markdown({ md, size = 'md' }: { md: string; size?: 'sm' | 'md' }) {
  const empty = md.trim() === '';
  return (
    <div className={s.root} data-size={size}>
      {empty ? (
        <p className={s.empty}>Nothing here yet.</p>
      ) : (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {md}
        </ReactMarkdown>
      )}
    </div>
  );
}
