import { useState } from 'react';
import { ESC, useEscape } from '@/lib/escape';
import { CloseIcon, PlusIcon } from '@/lib/icons';
import { catColor } from '@/lib/vm';
import { Hint } from '@/components/ui/hint/hint';

export interface CategoryEditorProps {
  /** The spec's categories. */
  categories: string[];
  /** Every category used in the project. */
  all: string[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
}

export interface CategorySuggestion {
  /** The category that gets added. */
  name: string;
  /** What the row says. */
  label: string;
}

/** Prototype lines 668-671: project categories not on the spec that contain the input, plus `Create “<x>”` for new text. */
export function categorySuggestions(all: string[], own: string[], input: string): CategorySuggestion[] {
  const inp = input.trim();
  const low = inp.toLowerCase();
  const out: CategorySuggestion[] = all.filter((c) => !own.includes(c) && c.toLowerCase().includes(low)).map((c) => ({ name: c, label: c }));
  if (inp && !all.some((c) => c.toLowerCase() === low)) out.push({ name: inp, label: `Create “${inp}”` });
  return out;
}

const dot = 'size-[7px] flex-none rounded-full';

/**
 * Category chips with × and "+ Category", which opens an input with suggestions (pinned behaviour 7).
 * The input keeps focus while you type, so the suggestions are a listbox under it rather than a menu; Esc
 * (through the board's Esc stack, above the modal and its menus) and a blur close it.
 */
export function CategoryEditor({ categories, all, onAdd, onRemove }: CategoryEditorProps) {
  const [adding, setAdding] = useState(false);
  const [input, setInput] = useState('');
  useEscape(adding, () => setAdding(false), ESC.input);
  const sugg = categorySuggestions(all, categories, input);

  const add = (name: string) => {
    setAdding(false);
    setInput('');
    if (!categories.includes(name)) onAdd(name);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {categories.map((c) => (
        <span key={c} className="inline-flex h-[26px] items-center gap-[5px] rounded-full border border-line pr-[3px] pl-[9px] text-[12.5px] text-fg2">
          <span className={dot} style={{ background: catColor(c) }} />
          {c}
          <Hint label={`Remove category ${c}`}>
            <button
              type="button"
              className="inline-flex size-[18px] cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-[13px] leading-none text-fg3 hover:bg-line hover:text-fg"
              aria-label={`Remove category ${c}`}
              onClick={() => onRemove(c)}
            >
              <CloseIcon aria-hidden />
            </button>
          </Hint>
        </span>
      ))}
      {adding ? (
        <div className="relative">
          <input
            className="h-[26px] w-[150px] rounded-full border border-accent bg-card px-2.5 py-0 text-[12.5px] text-fg outline-none"
            value={input}
            placeholder="Category…"
            aria-label="Category"
            autoFocus
            onChange={(e) => setInput(e.target.value)}
            onBlur={() => setAdding(false)}
            onKeyDown={(e) => {
              const inp = input.trim();
              if (e.key === 'Enter' && inp) {
                e.preventDefault();
                add(all.find((c) => c.toLowerCase() === inp.toLowerCase()) ?? inp);
              }
            }}
          />
          <div
            className="absolute top-[31px] left-0 z-[6] flex w-[200px] flex-col rounded-[9px] border border-line bg-card p-1 shadow-lg"
            role="listbox"
            aria-label="Category suggestions"
          >
            {sugg.map((o) => (
              <button
                key={o.label}
                type="button"
                role="option"
                aria-selected={false}
                className="flex cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-[9px] py-[7px] text-left text-[12.5px] text-fg hover:bg-panel"
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(o.name);
                }}
              >
                <span className={dot} style={{ background: catColor(o.name) }} />
                {o.label}
              </button>
            ))}
            {sugg.length === 0 && <span className="px-[9px] py-[7px] text-[12px] text-fg3">Type a new category name</span>}
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="h-[26px] cursor-pointer rounded-full border border-dashed border-line2 bg-transparent px-2.5 py-0 text-[12.5px] text-fg2 hover:border-fg3 hover:text-fg"
          onClick={() => {
            setInput('');
            setAdding(true);
          }}
        >
          <PlusIcon aria-hidden className="inline" /> Category
        </button>
      )}
    </div>
  );
}
