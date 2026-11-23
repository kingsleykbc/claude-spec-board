import { describe, expect, it } from 'vitest';
import type { Spec } from '@specboard/core';
import { recipeSpec, recipeSpecs } from '../fixtures/recipeBox';
import { ReviewIcon, TodoIcon } from './icons';
import { blockedReasons, blockTexts, canWriteUp, catColor, firstParagraph, fmtLogTime, isBlocked, needBlocks, relPath, relTime, runHold, statusMeta, tokensUsed, truncate, urgVm } from './vm';

// The prototype's hue(), copied as-is, to pin catColor to it.
const hue = (n: string) => {
  let h = 0;
  for (const ch of n.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return Math.round((h * 137.508) % 360);
};

describe('vm', () => {
  it('catColor reproduces the prototype formula', () => {
    expect(catColor('Frontend')).toBe(`oklch(0.66 0.14 ${hue('Frontend')})`);
    expect(catColor('backend')).toBe(catColor('Backend'));
  });

  it('urgVm matches the prototype', () => {
    const filled = (k: Parameters<typeof urgVm>[0]) => urgVm(k).bars.filter((b) => b.c !== 'var(--line2)').length;
    expect(filled('normal')).toBe(2);
    expect(filled('urgent')).toBe(3);
    expect(filled('high')).toBe(3);
    expect(filled('low')).toBe(1);
    expect(urgVm('normal').bars.map((b) => b.h)).toEqual(['5px', '8px', '11px']);
    expect(urgVm('urgent')).toEqual({
      key: 'urgent',
      label: 'Urgent',
      bars: [
        { h: '5px', c: 'var(--accent)' },
        { h: '8px', c: 'var(--accent)' },
        { h: '11px', c: 'var(--accent)' },
      ],
      fg: 'var(--accent-ink)',
      weight: 600,
      bg: 'var(--accent-soft)',
      pad: '2px 7px 2px 6px',
    });
    expect(urgVm('low')).toMatchObject({ fg: 'var(--fg3)', weight: 500, bg: 'transparent', pad: '2px 0' });
    expect(urgVm('high').bars[0]!.c).toBe('var(--fg2)');
  });

  it('statusMeta copies ST', () => {
    expect(statusMeta('review')).toEqual({ label: 'Review', icon: ReviewIcon, ink: 'var(--review-ink)', soft: 'var(--review-soft)' });
    expect(statusMeta('todo').icon).toBe(TodoIcon);
  });

  it('fmtLogTime', () => {
    expect(fmtLogTime('2026-11-07 15:12')).toBe('Nov 7, 15:12');
    expect(fmtLogTime('2026-11-07T15:12')).toBe('Nov 7, 15:12');
    expect(fmtLogTime('2026-01-30T09:05:59')).toBe('Jan 30, 09:05');
    expect(fmtLogTime('2026-12-01 23:59:00')).toBe('Dec 1, 23:59');
    expect(fmtLogTime('garbage')).toBe('garbage');
  });

  it('truncate', () => {
    const q = 'Should the export include quantities?';
    expect(truncate(q, 40)).toBe(q);
    const out = truncate('x'.repeat(50), 40);
    expect(out.endsWith('…')).toBe(true);
    expect(out).toHaveLength(40);
  });

  it('firstParagraph skips headings and joins wrapped lines', () => {
    expect(firstParagraph('Combine the ingredients\ninto one list.\n\n## Features\n- a')).toBe('Combine the ingredients into one list.');
    expect(firstParagraph('\r\n\r\n# Title\r\n\r\nBody here.')).toBe('Body here.');
    expect(firstParagraph('')).toBe('');
  });

  it('relTime', () => {
    const now = new Date(2026, 10, 8, 12, 0);
    expect(relTime('2026-11-08T11:59:40', now)).toBe('just now');
    expect(relTime('2026-11-08T11:45', now)).toBe('15m ago');
    expect(relTime('2026-11-08T09:30', now)).toBe('2h ago');
    expect(relTime('2026-11-06 12:00', now)).toBe('2d ago');
    expect(relTime('2026-09-01', now)).toBe('Sep 1');
    expect(relTime(null, now)).toBe('');
  });
});

describe('relPath', () => {
  it('makes a path project-relative with forward slashes', () => {
    expect(relPath('C:\\proj\\box', 'C:\\proj\\box\\.specboard\\specs\\T-1-a\\spec.md')).toBe('.specboard/specs/T-1-a/spec.md');
    expect(relPath('c:/proj/box/', 'C:\\proj\\box\\x.md')).toBe('x.md');
    expect(relPath('/home/u/box', '/home/u/box/.specboard/specs/T-1/spec.md')).toBe('.specboard/specs/T-1/spec.md');
    expect(relPath('/home/u/box', '/elsewhere/x.md')).toBe('/elsewhere/x.md');
  });
});

describe('runHold', () => {
  const all = [recipeSpec('T-104'), recipeSpec('T-105'), recipeSpec('T-107'), recipeSpec('T-108')];
  const spec = (over: Partial<Spec>): Spec => ({ ...recipeSpec('T-104'), questions: [], dependsOn: [], draft: false, ...over });

  it('nothing for a spec that can start', () => {
    expect(runHold(spec({}), all)).toBeNull();
  });
  it('a draft, and open questions, in the design’s wording', () => {
    expect(runHold(spec({ draft: true }), all)).toBe('Draft. Have Claude write this up first.');
    const q = { ...recipeSpec('T-105').questions[0]!, text: 'No. of versions', answer: null };
    expect(runHold(spec({ questions: [q] }), all)).toBe('Blocked. Awaiting answers on: No. of versions');
  });
  it('an unfinished, missing or own dependency; a done or archived one is no hold', () => {
    const dep = { ...recipeSpec('T-104'), id: 'T-120', title: 'Dep', status: 'doing' as const, archived: false };
    expect(runHold(spec({ dependsOn: ['T-120'] }), [dep])).toBe('Blocked. Waiting on T-120 Dep (Doing)');
    expect(runHold(spec({ dependsOn: ['T-120'] }), [])).toBe('Blocked. T-120 not found');
    expect(runHold(spec({ dependsOn: ['T-104'] }), all)).toBe('Blocked. Depends on itself');
    expect(runHold(spec({ dependsOn: ['T-120'] }), [{ ...dep, status: 'done' }])).toBeNull();
    expect(runHold(spec({ dependsOn: ['T-120'] }), [{ ...dep, archived: true }])).toBeNull();
  });
  it('a Review or Done card, and one Claude is working on in a chat, in the brief’s wording', () => {
    expect(runHold(spec({ status: 'review' }), all)).toBe('In Review: check the work, then move the card to Done.');
    expect(runHold(spec({ status: 'done' }), all)).toBe('Already done.');
    expect(runHold(spec({}), all, 2)).toBe('Claude is working on this in a chat.');
    expect(runHold(spec({}), all, null)).toBeNull();
  });
  it('Review and Done win over a draft or a block', () => {
    const blocked = { draft: true, dependsOn: ['T-120'], blocked: true, blockedReasons: ['T-120 not found'] };
    expect(runHold(spec({ ...blocked, status: 'review' }), [])).toBe('In Review: check the work, then move the card to Done.');
    expect(runHold(spec({ ...blocked, status: 'done' }), [])).toBe('Already done.');
    expect(runHold(spec({ ...blocked }), [], 1)).toBe('Claude is working on this in a chat.');
  });
});

describe('blocked state for Review and Done', () => {
  const dep = { ...recipeSpec('T-104'), id: 'T-120', title: 'Dep', status: 'doing' as const, archived: false };
  const spec = (over: Partial<Spec>): Spec => ({
    ...recipeSpec('T-104'),
    questions: [{ ...recipeSpec('T-105').questions[0]!, text: 'No. of versions', answer: null, required: true }],
    dependsOn: ['T-120'],
    blocked: true,
    blockedReasons: ['1 open question', 'Waiting on T-120 (doing)'],
    ...over,
  });

  it('a To-do or Doing spec is blocked as the core says', () => {
    for (const status of ['todo', 'doing'] as const) {
      expect(isBlocked(spec({ status }))).toBe(true);
      expect(blockedReasons(spec({ status }))).toEqual(['1 open question', 'Waiting on T-120 (doing)']);
      expect(blockTexts(spec({ status }), [dep]).map((r) => r.key)).toEqual(['q', 'dep:T-120']);
      expect(needBlocks(spec({ status }), undefined)).toBe(true);
      expect(needBlocks(spec({ status }), dep)).toBe(true);
      expect(needBlocks(spec({ status }), { ...dep, status: 'done' })).toBe(false);
    }
  });

  it('a Review or Done spec is never blocked, and its needs never draw as blocking', () => {
    for (const status of ['review', 'done'] as const) {
      expect(isBlocked(spec({ status }))).toBe(false);
      expect(blockedReasons(spec({ status }))).toEqual([]);
      expect(blockTexts(spec({ status }), [dep])).toEqual([]);
      expect(needBlocks(spec({ status }), undefined)).toBe(false);
      expect(needBlocks(spec({ status }), dep)).toBe(false);
    }
  });

  it('a draft can be written up only before Review', () => {
    expect(canWriteUp(spec({ draft: true, status: 'todo' }))).toBe(true);
    expect(canWriteUp(spec({ draft: true, status: 'doing' }))).toBe(true);
    expect(canWriteUp(spec({ draft: true, status: 'review' }))).toBe(false);
    expect(canWriteUp(spec({ draft: true, status: 'done' }))).toBe(false);
    expect(canWriteUp(spec({ draft: false, status: 'todo' }))).toBe(false);
  });
});

describe('tokensUsed', () => {
  it('sums the log tokens, null when none are counted', () => {
    const base = { ...recipeSpecs[0]!, logs: {} };
    const log = { subtask: 1, commit: null, files: [], pr: null, doneAt: null, obsolete: null, entries: [], problems: [] };
    expect(tokensUsed(base)).toBeNull();
    expect(tokensUsed({ ...base, logs: { 1: { ...log, tokens: null } } })).toBeNull();
    expect(tokensUsed({ ...base, logs: { 1: { ...log, tokens: 1200 }, 2: { ...log, tokens: null }, 3: { ...log, tokens: 48000 } } })).toBe(49200);
  });
});

