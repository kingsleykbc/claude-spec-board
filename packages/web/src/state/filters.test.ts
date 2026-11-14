import { describe, expect, it } from 'vitest';
import { categoryOptions, filterChips, filterSpecs, milestoneOptions, NO_FILTERS, NO_MILESTONE, sortSpecs, waitItems } from './filters';
import { recipeArchived, recipeSpecs } from '../fixtures/recipeBox';

const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe('sortSpecs (pinned behaviour 1)', () => {
  it('puts T-106 (urgent) first in To-do, then by urgency and numeric ID', () => {
    const todo = recipeSpecs.filter((s) => s.status === 'todo');
    expect(ids(sortSpecs(todo))).toEqual(['T-106', 'T-105', 'T-108', 'T-107']);
  });

  it('compares IDs numerically and does not mutate its input', () => {
    const a = { ...recipeSpecs[0]!, id: 'T-1000', urgency: 'normal' as const };
    const b = { ...recipeSpecs[0]!, id: 'T-999', urgency: 'normal' as const };
    const input = [a, b];
    expect(ids(sortSpecs(input))).toEqual(['T-999', 'T-1000']);
    expect(ids(input)).toEqual(['T-1000', 'T-999']);
  });
});

describe('filterSpecs (pinned behaviour 4)', () => {
  it('no filters → everything', () => {
    expect(filterSpecs(recipeSpecs, NO_FILTERS)).toHaveLength(recipeSpecs.length);
  });

  it('category Backend AND urgency normal → T-105 only', () => {
    expect(ids(filterSpecs(recipeSpecs, { cats: ['Backend'], urg: ['normal'], blocked: false, milestone: null }))).toEqual(['T-105']);
  });

  it('OR within a group', () => {
    expect(ids(filterSpecs(recipeSpecs, { cats: ['Auth', 'Backend'], urg: [], blocked: false, milestone: null }))).toEqual(['T-103', 'T-105', 'T-106']);
    expect(ids(filterSpecs(recipeSpecs, { cats: [], urg: ['urgent', 'low'], blocked: false, milestone: null }))).toEqual(['T-106', 'T-107']);
  });

  it('Blocked only → T-105 and T-108', () => {
    expect(ids(filterSpecs(recipeSpecs, { cats: [], urg: [], blocked: true, milestone: null }))).toEqual(['T-105', 'T-108']);
  });
});

describe('waitItems (pinned behaviour 3)', () => {
  it('on the sample → review, questions, blocked', () => {
    const w = waitItems(recipeSpecs);
    expect(w.map((x) => x.text)).toEqual(['1 to review', '3 questions for you', '2 blocked']);
    expect(w.map((x) => x.kind)).toEqual(['review', 'questions', 'blocked']);
    expect(w[0]!.target).toBe('T-103');
    expect(w[1]!.target).toBe('T-105');
  });

  it('hides zero counts and uses the singular for one question', () => {
    const t105 = recipeSpecs.find((s) => s.id === 'T-105')!;
    const one = { ...t105, status: 'done' as const, blocked: false, questions: t105.questions.slice(0, 1) };
    expect(waitItems([one]).map((x) => x.text)).toEqual(['1 question for you']);
    expect(waitItems([])).toEqual([]);
  });

  it('ignores archived specs', () => {
    expect(waitItems(recipeArchived)).toEqual([]);
  });
});

describe('filter bar helpers', () => {
  it('category options list every category, counted over live specs', () => {
    expect(categoryOptions(recipeSpecs, recipeArchived)).toEqual([
      { name: 'Frontend', n: 6 },
      { name: 'Backend', n: 3 },
      { name: 'Auth', n: 1 },
      { name: 'Infra', n: 0 },
    ]);
  });

  it('chips for each active filter', () => {
    const chips = filterChips({ cats: ['Backend'], urg: ['urgent'], blocked: true, milestone: null });
    expect(chips.map((c) => [c.prefix, c.label])).toEqual([
      ['Category', 'Backend'],
      ['Urgency', 'Urgent'],
      ['', 'Blocked only'],
    ]);
    expect(chips[0]!.without).toEqual({ cats: [], urg: ['urgent'], blocked: true, milestone: null });
    expect(chips[2]!.without).toEqual({ cats: ['Backend'], urg: ['urgent'], blocked: false, milestone: null });
  });
});

// Basics: T-101, T-102, T-103 and archived T-100; Planner: T-104, T-105; Polish: none; the rest have no milestone.
const MS = ['Basics', 'Planner', 'Polish'];
const IN: Record<string, string> = { 'T-100': 'Basics', 'T-101': 'Basics', 'T-102': 'Basics', 'T-103': 'Basics', 'T-104': 'Planner', 'T-105': 'Planner', 'T-106': 'Typo' };
const withMs = <T extends { id: string; milestone: string | null }>(xs: T[]) => xs.map((x) => ({ ...x, milestone: IN[x.id] ?? null }));
const live = withMs(recipeSpecs);
const arch = withMs(recipeArchived);

describe('filterSpecs: milestone', () => {
  it('keeps only the chosen milestone when the project has milestones', () => {
    expect(ids(filterSpecs(live, { ...NO_FILTERS, milestone: 'Planner' }, MS))).toEqual(['T-104', 'T-105']);
    expect(ids(filterSpecs(live, { ...NO_FILTERS, milestone: 'Polish' }, MS))).toEqual([]);
  });

  it('No milestone keeps specs with none or an unknown one', () => {
    expect(ids(filterSpecs(live, { ...NO_FILTERS, milestone: NO_MILESTONE }, MS))).toEqual(['T-106', 'T-107', 'T-108']);
  });

  it('null (all milestones) or no milestone list → no milestone filtering', () => {
    expect(filterSpecs(live, NO_FILTERS, MS)).toHaveLength(live.length);
    expect(filterSpecs(live, { ...NO_FILTERS, milestone: 'Planner' })).toHaveLength(live.length);
  });

  it('combines with the other filters', () => {
    expect(ids(filterSpecs(live, { ...NO_FILTERS, blocked: true, milestone: 'Planner' }, MS))).toEqual(['T-105']);
  });
});

describe('milestoneOptions', () => {
  it('each listed milestone with done/total (archived counted done), then No milestone when any', () => {
    expect(milestoneOptions(live, arch, MS)).toEqual([
      { value: 'Basics', label: 'Basics', done: 3, total: 4 },
      { value: 'Planner', label: 'Planner', done: 0, total: 2 },
      { value: 'Polish', label: 'Polish', done: 0, total: 0 },
      { value: NO_MILESTONE, label: 'No milestone', done: 0, total: 3 },
    ]);
  });

  it('no No milestone option when every spec has one; nothing without milestones', () => {
    const all = live.map((x) => ({ ...x, milestone: 'Basics' }));
    expect(milestoneOptions(all, [], MS).map((o) => o.label)).toEqual(['Basics', 'Planner', 'Polish']);
    expect(milestoneOptions(live, arch, [])).toEqual([]);
  });
});

