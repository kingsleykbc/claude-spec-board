import { useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CaretIcon, CaretRightIcon, CheckIcon, CopyIcon } from '@/lib/icons';
import { useCopyCommand } from '@/lib/useCopyCommand';
import { cn } from '@/lib/utils';

// A To review item's "How to check" steps: a collapsed toggle that opens a numbered list. Each step is inline Markdown:
// http and https links open in a new tab, other links are plain text, and each `code` span has its own copy button.

const SAFE_LINK = /^https?:\/\//i;

/** A `code` span with a small button that copies its text. */
function CopyCode({ text }: { text: string }) {
  const { state, copy } = useCopyCommand(text);
  const label = state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : `Copy ${text}`;
  return (
    <span className="inline-flex items-center gap-0.5 align-baseline">
      <code className="rounded-[4px] border border-line bg-code px-[5px] font-mono text-[0.92em] break-all text-fg select-all">{text}</code>
      <button
        type="button"
        className="inline-flex size-[20px] flex-none cursor-pointer items-center justify-center rounded-[5px] border-0 bg-transparent p-0 text-[12px] text-fg3 hover:bg-panel hover:text-fg data-[copied=true]:text-done-ink"
        data-copied={state === 'copied'}
        aria-label={label}
        title={label}
        onClick={copy}
      >
        {state === 'copied' ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
      </button>
    </span>
  );
}

const components: Components = {
  a: ({ node: _n, href, children }) =>
    href && SAFE_LINK.test(href) ? (
      <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium break-all text-accent-ink underline">
        {children}
      </a>
    ) : (
      <span>{children}</span>
    ),
  img: () => null,
  code: ({ node: _n, children }) => <CopyCode text={String(children)} />,
  p: ({ node: _n, children }) => <>{children}</>,
};

const ALLOWED = ['strong', 'em', 'code', 'del', 'a', 'img', 'p'];

/** One step as an inline run of Markdown. */
export function StepMarkdown({ md }: { md: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} allowedElements={ALLOWED} unwrapDisallowed>
      {md}
    </ReactMarkdown>
  );
}

/** The collapsed How to check toggle and, open, the numbered steps. */
export function ReviewSteps({ id, steps }: { id: string; steps: string[] }) {
  const [open, setOpen] = useState(false);
  if (steps.length === 0) return null;
  return (
    <div className="mt-1">
      <button
        type="button"
        className="inline-flex cursor-pointer items-center gap-1 rounded-[6px] border-0 bg-transparent px-0 py-0.5 text-[12.5px] font-semibold text-fg2 hover:text-fg"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <CaretIcon aria-hidden /> : <CaretRightIcon aria-hidden />}
        How to check
      </button>
      {open && (
        <ol id={id} className={cn('m-0 mt-1 flex list-decimal flex-col gap-1 pl-6 text-[13px] leading-[1.5] text-fg')}>
          {steps.map((s, i) => (
            <li key={i}>
              <StepMarkdown md={s} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
