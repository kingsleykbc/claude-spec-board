import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CaretIcon, CaretUpIcon, CheckIcon, CopyIcon, LogIcon } from '@/lib/icons';
import { useCopyCommand } from '@/lib/useCopyCommand';

// A To review item's "How to check" steps: a toggle on the item's row that opens a numbered list under it. Each step is inline Markdown:
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

/** The How to check toggle, at the right end of an item's row like a subtask's Log button. */
export function ReviewStepsToggle({ controls, open, onToggle }: { controls: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="flex h-[26px] flex-none cursor-pointer items-center gap-1.5 rounded-md border-0 bg-transparent px-[9px] py-0 text-[12.5px] whitespace-nowrap text-fg2 hover:bg-panel hover:text-fg aria-expanded:bg-panel"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
    >
      <LogIcon aria-hidden className="text-[14px]" />
      How to check
      {open ? <CaretUpIcon aria-hidden className="text-[12px]" /> : <CaretIcon aria-hidden className="text-[12px]" />}
    </button>
  );
}

/** The open steps: a numbered list in a panel under the item's row, like an open subtask log. */
export function ReviewStepsList({ id, steps }: { id: string; steps: string[] }) {
  return (
    <div className="mr-4 mb-3.5 ml-[45px] animate-[sbIn_0.2s_ease-out] rounded-[10px] border border-line bg-bg px-4 py-3">
      <ol id={id} className="m-0 flex list-decimal flex-col gap-1 pl-5 text-[13px] leading-[1.5] text-fg">
        {steps.map((s, i) => (
          <li key={i}>
            <StepMarkdown md={s} />
          </li>
        ))}
      </ol>
    </div>
  );
}
