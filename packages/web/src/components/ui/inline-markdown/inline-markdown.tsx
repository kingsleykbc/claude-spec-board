import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

// One inline run for a card description. Bold, italics, code and strike-through render; everything
// else is unwrapped to its text. Links are plain text (a card is itself a button) and images are
// dropped. Raw HTML is never enabled (no rehype-raw).
const components: Components = {
  a: ({ node: _n, children }) => <span>{children}</span>,
  img: () => null,
  code: ({ node: _n, children }) => <code className="font-mono text-[0.92em]">{children}</code>,
  p: ({ node: _n, children }) => <>{children}</>,
};

const ALLOWED = ['strong', 'em', 'code', 'del', 'a', 'img', 'p'];

/** Renders Markdown as a single inline run: no paragraph, block elements unwrapped. */
export function InlineMarkdown({ md }: { md: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} allowedElements={ALLOWED} unwrapDisallowed>
      {md}
    </ReactMarkdown>
  );
}
