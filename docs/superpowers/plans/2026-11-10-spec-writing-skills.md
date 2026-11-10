# Spec-writing skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Specs that say what "done" means, end with the project's closing steps, and mark the person's own steps; plus `/plan-project`, `/import-specs` and `/reorganize`.

**Architecture:** Mostly Markdown skills in `packages/server/kit/skills/`. Code changes are small: a core helper that recognises `(you)` subtasks, a "you" tag in the card detail, and a "Waiting on you" run end in the server and web run panel. No parser grammar change: `## Done when` is an ordinary extra section and `closing_steps` an extra config key, both already kept by the parser.

**Tech Stack:** TypeScript, npm workspaces (`@specboard/core`, `@specboard/server` Hono, `@specboard/web` React 19 + vitest + Storybook), Claude Code skills (SKILL.md).

**Spec:** `docs/superpowers/specs/2026-11-10-spec-writing-skills-design.md` (read it first; it is the source for every rule below).

## Global Constraints

- Windows 11, Node 22. No new dependencies.
- Existing specs and boards keep working unchanged.
- Skills stay short and plain, like the existing ones. Every command skill keeps the two opening lines the kit tests require (load `specboard` via the Skill tool; read `CLAUDE.md`) and takes `$ARGUMENTS`; commands have `disable-model-invocation: true`.
- No skill line may mention `status: done` or `git push` except as a prohibition (line contains "never"). No skill may tell Claude to run `rm`, `mv`, `mkdir`, `cp`, `echo`, `git checkout`, `git reset`, `git branch`.
- `(you)` prefix is exactly `(you) ` at the start of a subtask title (match case-insensitively, after trimming).
- Board changes are limited to the "you" tag and the "Waiting on you" run end.
- Kingsley's recipe-box test edits are in `git stash@{0}`; do not pop or drop it.
- Verification commands: `npm test` at repo root (all workspaces), `npx tsc -p packages/<pkg>/tsconfig.json --noEmit` per package, `npm run test-storybook -w @specboard/web` if that script exists (otherwise the storybook vitest project the repo already uses).

## Review Focus

1. A subtask titled `(You) Add key` or `  (you)  Add key` (case/spacing): recognised as the person's step, shown with the tag, text shown without the prefix.
2. A subtask that merely *contains* "(you)" mid-title (`Ask (you) later`): not a person step.
3. A run that stops at a `(you)` step **and** had a refused action: the permission end still wins (existing order), not "Waiting on you".
4. A run that stops at a `(you)` step after Claude added a new question: the question end wins.
5. A spec whose only unticked subtasks are trailing `(you)` steps but Claude did not move it to Review: shows "Waiting on you" with the first such step, not "Claude stopped before finishing".

---

### Task 1: Core helper for `(you)` subtasks

**Files:**
- Create: `packages/core/src/you.ts`
- Modify: `packages/core/src/index.ts` (add `export * from './you.js';`)
- Test: `packages/core/test/you.test.ts`

**Interfaces:**
- Produces: `youStep(title: string): string | null` — the step text without the prefix when `title` (trimmed) starts with `(you)` case-insensitively followed by whitespace; otherwise `null`. Also `firstOpenYouStep(subtasks: { done: boolean; title: string }[]): string | null` — `youStep` of the first unticked subtask, or `null` if there is none or it is not a person step.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { firstOpenYouStep, youStep } from '../src/you.js';

describe('youStep', () => {
  it('recognises the prefix and returns the rest', () => {
    expect(youStep('(you) Add the API key')).toBe('Add the API key');
    expect(youStep('  (You)   Try it on your phone ')).toBe('Try it on your phone');
  });
  it('is null for ordinary titles and mid-title mentions', () => {
    expect(youStep('Build the page')).toBeNull();
    expect(youStep('Ask (you) later')).toBeNull();
    expect(youStep('(you)')).toBeNull();
    expect(youStep('(youth) club')).toBeNull();
  });
});

describe('firstOpenYouStep', () => {
  const t = (done: boolean, title: string) => ({ done, title });
  it('is the first unticked subtask when it is a person step', () => {
    expect(firstOpenYouStep([t(true, 'Build'), t(false, '(you) Add design'), t(false, 'Wire up')])).toBe('Add design');
  });
  it('is null when the first unticked subtask is Claude’s, or all are done', () => {
    expect(firstOpenYouStep([t(false, 'Build'), t(false, '(you) Check')])).toBeNull();
    expect(firstOpenYouStep([t(true, '(you) Check')])).toBeNull();
    expect(firstOpenYouStep([])).toBeNull();
  });
});
```

- [ ] **Step 2: Run** `npm test -w @specboard/core -- you` → FAIL (module not found).
- [ ] **Step 3: Implement** both functions in `you.ts` (one regex: `/^\(you\)\s+(\S.*)$/i` on the trimmed title, return the group trimmed) and export from `index.ts`.
- [ ] **Step 4: Run** `npm test -w @specboard/core` → PASS, and `npx tsc -p packages/core/tsconfig.json --noEmit` → exit 0.
- [ ] **Step 5: Commit** `git add packages/core && git commit -m "core: recognise (you) subtasks"`

### Task 2: "you" tag in the card detail

**Files:**
- Modify: `packages/web/src/components/detail/Subtasks.tsx` (the `<label>` around line 103), `packages/web/src/components/detail/detail.module.css` or the module `Subtasks.tsx` imports (add `.you`)
- Test: `packages/web/src/components/detail/Subtasks.test.tsx`
- Story: add a `PersonSteps` story to the existing Subtasks stories file (or `parts.stories.tsx`, wherever Subtasks stories live)

**Interfaces:**
- Consumes: `youStep` from `@specboard/core` (Task 1).

- [ ] **Step 1: Write the failing test** `'a (you) subtask shows a "you" tag and its text without the prefix'`: render Subtasks (as the existing tests do) with subtasks `[{n:1,title:'(you) Add the design',done:false},{n:2,title:'Build it',done:false}]`; expect `screen.getByText('Add the design')`, `screen.queryByText('(you) Add the design')` to be null, exactly one element with `data-testid="you-tag"` whose text is `you`, inside row `[data-subtask="1"]`, and the checkbox for row 1 is still labelled so that `getByLabelText(/Add the design/)` finds it.
- [ ] **Step 2: Run** `npx vitest run src/components/detail/Subtasks.test.tsx` in `packages/web` → FAIL.
- [ ] **Step 3: Implement**: in the label, `const you = youStep(t.title)`; when non-null render `<span data-testid="you-tag" className={s.you} title="Your step: Claude stops here and waits for you to tick it">you</span>` before the text `you`. Style `.you` like the existing small chips (review colours from tokens), legible in light and dark. Simple mode shows it too (no change needed).
- [ ] **Step 4: Run** web tests and the storybook tests → PASS; `npx tsc -p packages/web/tsconfig.json --noEmit` → exit 0.
- [ ] **Step 5: Commit** `git commit -m "web: show a you tag on (you) subtasks"`

### Task 3: "Waiting on you" run end

**Files:**
- Modify: `packages/server/src/claude/classify.ts` (`EndInfo`, `classifyEnd`), `packages/server/src/claude/runs.ts` (`finalLine`), `packages/web/src/api/client.ts` (`EndInfo`), `packages/web/src/components/detail/RunPanel.tsx`, `packages/web/src/state/runUi.ts` (`endedToast`)
- Test: `packages/server/test/claude-classify.test.ts`, `packages/server/test/runs.test.ts`, `packages/web/src/components/detail/RunPanel.test.tsx`, the runUi test file
- Story: `RunPanel.stories.tsx` `WaitingOnYou`

**Interfaces:**
- Consumes: `firstOpenYouStep` (Task 1).
- Produces: `EndInfo.waiting?: string` (server and web). Status stays `'needs'` (no new `RunStatus`).

- [ ] **Step 1: Write failing classify tests** (use the file's existing helpers for `before`/`after` specs):
  - `'stopping at a (you) step is waiting, not an error'`: kind `run`, no denials, no new questions, after status `doing`, subtasks `[done 'Build', open '(you) Add the key', open 'Wire up']` → `{ status: 'needs', title: 'Waiting on you', text: 'Add the key', waiting: 'Add the key' }`.
  - `'only trailing (you) steps left but not in Review is still waiting'` → same shape with the first trailing step.
  - `'a refused action wins over a (you) step'` → `status: 'permission'`.
  - `'a new question wins over a (you) step'` → `status: 'needs'`, `title: 'Claude has a question'`, no `waiting`.
  - `'an ordinary unticked subtask is still an error'` → `status: 'error'` (existing behaviour unchanged).
- [ ] **Step 2: Write failing runs test**: `finalLine` for that end gives `{ k: 'warn', text: 'Paused: waiting on you', code: 'Add the key' }` (assert through a run with the fake launcher, as the existing `needs` final-line test does).
- [ ] **Step 3: Run** `npm test -w @specboard/server -- claude-classify runs` → FAIL.
- [ ] **Step 4: Implement**: in `classifyEnd`, just before the final `error` return (after the `afterInReview` check), `const you = after ? firstOpenYouStep(after.subtasks) : null; if (you) return withRefusals({ status: 'needs', title: 'Waiting on you', text: you, waiting: you }, result.denials);` In `finalLine`'s `needs` case, return the waiting line first when `end.waiting`.
- [ ] **Step 5: Write failing web tests**: RunPanel with `status: 'needs', end: { status:'needs', title:'Waiting on you', text:'Add the key', waiting:'Add the key' }` shows title `Waiting on you`, text `Claude stopped at your step: Add the key. Do it, tick it, then run again.`, chip `Waiting on you`, and **no** "Go to question" button. `endedToast` for that run gives `['warn', '<ID> is waiting on you', 'Add the key']`.
- [ ] **Step 6: Implement** in `RunPanel.tsx` a `waiting` entry used instead of `needs` when `end.waiting` is set (title, text above, review colours, no action) and the chip label `Waiting on you`; in `endedToast` check `end?.waiting` inside the `needs` case. Add the `WaitingOnYou` story.
- [ ] **Step 7: Run** `npm test` at root → PASS; tsc for server and web → exit 0.
- [ ] **Step 8: Commit** `git commit -m "Runs that stop at a (you) step read as Waiting on you"`

### Task 4: The `specboard` rules skill

**Files:**
- Modify: `packages/server/kit/skills/specboard/SKILL.md`
- Test: `packages/server/test/kit.test.ts`

- [ ] **Step 1: Write failing kit tests**:
  - `'the format documents Done when, (you) steps and closing_steps'`: the rules text contains `## Done when`, `(you) `, `closing_steps`.
  - Extend `'spec samples … parse'`: the sample's body contains `## Done when` and its last subtask title satisfies `youStep(...) !== null`. Keep the existing assertions, updating the subtask expectation to the new list (`[[1,true],[2,false],[3,false],[4,false]]` if one `(you)` step is appended).
  - `'running stops at a (you) step with Claude work after it, and checks Done when before Review'`: `runningSection` contains `(you)`, `Done when` and `needs your check`.
- [ ] **Step 2: Run** `npm test -w @specboard/server -- kit` → FAIL.
- [ ] **Step 3: Edit the skill** (all rules from the design's "What a spec looks like" section):
  - Layout/config: `closing_steps` (list) in config.md.
  - Format: `## Done when` in the sections list and the example (2 lines); a `(you)` subtask at the end of the example; a short paragraph on `(you)` subtasks.
  - New `## Writing a good spec` section: first sentence explains the spec alone; Done when = 2–5 observable checks, prefer ones a test or the code can prove, person-only checks become trailing `(you)` steps; small subtasks each doable and checkable; closing steps from `closing_steps` last (leave one out only when plainly not needed, and say so); `(you)` steps where they belong (before = first, after = last); questions only for real decisions.
  - Running: step 4 loop — at an unticked `(you)` subtask that has Claude subtasks after it: set `current_subtask: null`, keep `doing`, say what is needed, stop, never tick it. Step 6 — when only `(you)` subtasks (or none) are left: check each Done-when line, write results in the log (met / not met / needs your check, and how) — new dated entry in the last code subtask's log if no subtask was done this run; a checked-and-not-met line → fix or add a required question and stop; otherwise `status: review` and list the remaining `(you)` steps in the summary.
- [ ] **Step 4: Run** kit tests → PASS.
- [ ] **Step 5: Commit** `git commit -m "kit: Done when, (you) steps and closing steps in the rules"`

### Task 5: `create-spec` clarify step, `next` skips person steps

**Files:**
- Modify: `packages/server/kit/skills/create-spec/SKILL.md`, `packages/server/kit/skills/next/SKILL.md`, `packages/server/src/claude/runs.ts` (`runPrompt` `'write-up'`)
- Test: `packages/server/test/kit.test.ts`, `packages/server/test/runs.test.ts` (line ~169)

- [ ] **Step 1: Write failing tests**: `runPrompt('write-up','T-001')` is `/specboard:create-spec T-001 --board`; create-spec text contains `--board` and `in the chat`; next text contains `(you)`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**: change `runPrompt`. create-spec: new step 0 — if the input ends with `--board`, strip it and skip clarifying (no one is in the chat; put those questions on the board); otherwise ask the 2–3 questions that would change the spec most, one message, and wait; if the idea is clear, say so and go on. Writing steps add Done when, closing steps (from config.md `closing_steps`) and any `(you)` subtasks per the rules skill; the final message also counts `(you)` steps. next: a spec whose first unticked subtask is a `(you)` step is not a candidate; mention it in the "no candidate"/choice message.
- [ ] **Step 4: Run** server tests → PASS.
- [ ] **Step 5: Commit** `git commit -m "kit: create-spec asks first in chat; next skips specs waiting on you"`

### Task 6: New commands `/plan-project`, `/import-specs`, `/reorganize`

**Files:**
- Create: `packages/server/kit/skills/plan-project/SKILL.md`, `packages/server/kit/skills/import-specs/SKILL.md`, `packages/server/kit/skills/reorganize/SKILL.md`
- Test: `packages/server/test/kit.test.ts` (`COMMANDS` list gains the three names; add one test per skill for its key safety line)

- [ ] **Step 1: Write failing tests**: `COMMANDS` includes `plan-project`, `import-specs`, `reorganize`; `import-specs` text matches `/never edit, move or delete the source/i`; `plan-project` text contains `draft: true` and `specboard init`; `reorganize` text contains `keep their numbers`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Write the three skills** from the design's sections of the same names. Front matter: `name`, one-line `description` with usage, `disable-model-invocation: true`, `argument-hint` (`[notes]`, `<path>`, `[instructions]`). Each confirms its proposal with the person before writing (mapping list / spec list / change list). None changes code. `import-specs`: Spec Kit, OpenSpec and free-form mappings; `done` work → at most `review`; source line at end of `## Spec`; other-repo tasks listed, not imported. `plan-project`: brownfield-first read, one question at a time, writes config.md (shows the diff and asks first if it exists), first specs as drafts with `depends_on`.
- [ ] **Step 4: Run** kit tests and `npm run specboard -- init` is untouched; check `installSkills` copies the new folders (existing kit test `kitPluginDir … skills next to its manifest` covers it) → PASS.
- [ ] **Step 5: Commit** `git commit -m "kit: plan-project, import-specs and reorganize commands"`

### Task 7: Docs, future plans and the sample

**Files:**
- Modify: `docs/guide/writing-specs.md`, `docs/guide/commands.md`, `docs/guide/getting-started.md`, `README.md`, `docs/documentation.md`, `docs/future-features.md`
- Modify: `examples/recipe-box/.specboard/config.md` (`closing_steps: [Write tests, Update the docs]`), `examples/recipe-box/.specboard/specs/T-105-shopping-list-export/spec.md` (add `## Done when`, 2–3 lines), `examples/recipe-box/.specboard/specs/T-108-share-recipe-link/spec.md` (append `- [ ] 5. (you) Open a shared link in a private window`)
- Modify: `packages/web/src/fixtures/recipeBox.ts` by hand to match (T-105 `bodyMd`, T-108 subtasks)

- [ ] **Step 1: Edit the sample and fixture**, then run `npm test` at root. Fix any expectation that counted T-108's subtasks (`0/4` → `0/5`) or T-105's body; nothing else should change.
- [ ] **Step 2: Docs**: writing-specs (Done when, `(you)` steps, closing steps, with the design's checkout example); commands + README (three new commands, `--board` not mentioned to users); getting-started (`/plan-project` right after `init`); documentation.md (format additions, "Waiting on you"); future-features (Setup presets Simple/Robust, Design docs, Claude artifacts — wording from the design's "Future plans").
- [ ] **Step 3: Docs page check**: the web docs page bundles these files; run web tests (DocsPage tests) → PASS.
- [ ] **Step 4: Commit** `git commit -m "Docs and sample: Done when, (you) steps, new commands, future presets"`

### Task 8: Whole-branch check

- [ ] Run `npm test` at root, tsc for all three packages, storybook tests → all pass.
- [ ] Build and run the board (`npm run board -- examples/recipe-box`): T-108 detail shows the "you" tag; T-105 shows its Done when section; light, dark and Simple mode.
- [ ] Confirm `git stash list` still shows Kingsley's stash and nothing popped it.
