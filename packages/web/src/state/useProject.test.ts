import { describe, expect, it } from 'vitest';
import type { Project, Spec } from '@specboard/core';
import { diffProjects } from './useProject';

const spec = (id: string, hash: string, extra: Partial<Spec> = {}): Spec =>
  ({ id, hash, archived: false, subtasks: [], questions: [], ...extra }) as unknown as Spec;
const project = (specs: Spec[], archived: Spec[] = []): Project => ({ root: '/', config: null, overview: null, specs, archived, problems: [] });
const sub = (n: number, done: boolean) => ({ n, title: `S${n}`, done, line: 0, hasLog: false });
const q = (id: string) => ({ id, type: 'text' as const, text: id, options: [], answer: null, line: 0 });

describe('diffProjects', () => {
  it('flags changed specs, their changed subtasks, and new questions', () => {
    const prev = project([spec('T-1', 'a', { subtasks: [sub(1, false), sub(2, false)], questions: [q('Q1')] }), spec('T-2', 'b')]);
    const next = project([
      spec('T-1', 'a2', { subtasks: [sub(1, true), sub(2, false), sub(3, false)], questions: [q('Q1'), q('Q2')] }),
      spec('T-2', 'b'),
      spec('T-3', 'c'),
    ]);
    const d = diffProjects(prev, next);
    expect([...d.changed].sort()).toEqual(['T-1', 'T-1:1', 'T-1:3', 'T-3']);
    expect([...d.newQuestions]).toEqual(['T-1:Q2']);
  });

  it('nothing changed → empty sets', () => {
    const p = project([spec('T-1', 'a')]);
    const d = diffProjects(p, project([spec('T-1', 'a')]));
    expect(d.changed.size).toBe(0);
    expect(d.newQuestions.size).toBe(0);
  });
});

describe('diffProjects: new specs (Task 7 carry-over a)', () => {
  it('questions of a spec that is new in this load are new questions', () => {
    const prev = project([spec('T-1', 'a')]);
    const next = project([spec('T-1', 'a'), spec('T-2', 'b', { questions: [q('Q1'), q('Q2')] })]);
    const d = diffProjects(prev, next);
    expect([...d.changed]).toEqual(['T-2']);
    expect([...d.newQuestions].sort()).toEqual(['T-2:Q1', 'T-2:Q2']);
  });
});
