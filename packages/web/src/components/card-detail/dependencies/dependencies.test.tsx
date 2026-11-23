import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { composeStories } from '@storybook/react-vite';
import type { Spec } from '@specboard/core';
import { recipeArchived, recipeSpec, recipeSpecs } from '@/fixtures/recipeBox';
import * as stories from './dependencies.stories';

const { Empty } = composeStories(stories);

const all = [...recipeSpecs, ...recipeArchived];

function setup(sp: Spec, specs: Spec[] = all) {
  const onOpen = vi.fn();
  render(<Empty spec={sp} all={specs} onOpen={onOpen} />);
  return { onOpen };
}
const list = (label: string) => screen.getByRole('list', { name: label });

afterEach(cleanup);

describe('Dependencies', () => {
  it('T-105 depends on T-104 (Doing, Not done) and nothing waits on it', () => {
    const { onOpen } = setup(recipeSpec('T-105'));
    expect(screen.getByText('DEPENDENCIES')).toBeTruthy();
    const needs = list('Depends on');
    const item = within(needs).getByRole('button');
    expect(item.textContent).toBe('T-104Meal planner calendar DoingNot done');
    expect(within(item).getByText('Not done').className).toMatch(/text-block-ink/);
    fireEvent.click(item);
    expect(onOpen).toHaveBeenCalledWith('T-104');
    expect(screen.getByText('No other spec waits on this one.')).toBeTruthy();
  });

  it('T-104 is needed by T-105 and can start any time', () => {
    const { onOpen } = setup(recipeSpec('T-104'));
    expect(screen.getByText('Nothing. This spec can start any time.')).toBeTruthy();
    const by = within(list('Needed by')).getByRole('button');
    expect(by.textContent).toBe('T-105Shopping list export To-do');
    fireEvent.click(by);
    expect(onOpen).toHaveBeenCalledWith('T-105');
  });

  it('a done dependency has no Not done note; an archived one counts as done', () => {
    const sp: Spec = { ...recipeSpec('T-104'), dependsOn: ['T-101', 'T-100'] };
    setup(sp);
    const items = within(list('Depends on')).getAllByRole('button');
    expect(items.map((b) => b.textContent)).toEqual(['T-101Recipe list page Done', `T-100${recipeArchived[0]!.title} Done`]);
  });

  it('an unknown dependency shows its ID with Not found in block ink', () => {
    const sp: Spec = { ...recipeSpec('T-104'), dependsOn: ['T-404'] };
    setup(sp);
    const needs = list('Depends on');
    expect(within(needs).queryByRole('button')).toBeNull();
    expect(within(needs).getByText('T-404')).toBeTruthy();
    expect(within(needs).getByText('Not found').className).toMatch(/text-block-ink/);
    expect(screen.queryByText('Nothing. This spec can start any time.')).toBeNull();
  });

  it('a spec in Review or Done flags none of its needs as blocking', () => {
    for (const status of ['review', 'done'] as const) {
      setup({ ...recipeSpec('T-105'), status, dependsOn: ['T-104', 'T-404'] });
      const needs = list('Depends on');
      expect(within(needs).getByRole('button').textContent).toBe('T-104Meal planner calendar Doing');
      expect(within(needs).queryByText('Not done')).toBeNull();
      const missing = within(needs).getByText('Not found');
      expect(missing.className).not.toMatch(/text-block-ink/);
      expect(missing.className).toMatch(/text-fg3/);
      cleanup();
    }
  });
});
