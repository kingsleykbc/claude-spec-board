import { useState } from 'react';
import { ESC, useEscape } from '../../lib/escape';
import { catColor } from '../../lib/vm';
import s from './detail.module.css';

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

/** Category chips with × and "+ Category", which opens an input with suggestions (pinned behaviour 7). */
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
    <div className={s.cats}>
      {categories.map((c) => (
        <span key={c} className={s.cat}>
          <span className={s.dot} style={{ background: catColor(c) }} />
          {c}
          <button type="button" className={s.catX} aria-label={`Remove category ${c}`} onClick={() => onRemove(c)}>
            ×
          </button>
        </span>
      ))}
      {adding ? (
        <div className={s.catInputWrap}>
          <input
            className={s.catInput}
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
          <div className={s.suggest} role="listbox" aria-label="Category suggestions">
            {sugg.map((o) => (
              <button
                key={o.label}
                type="button"
                role="option"
                aria-selected={false}
                className={s.suggestItem}
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(o.name);
                }}
              >
                <span className={s.dot} style={{ background: catColor(o.name) }} />
                {o.label}
              </button>
            ))}
            {sugg.length === 0 && <span className={s.suggestNone}>Type a new category name</span>}
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={s.addCat}
          onClick={() => {
            setInput('');
            setAdding(true);
          }}
        >
          + Category
        </button>
      )}
    </div>
  );
}
