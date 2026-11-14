import { afterEach, describe, expect, it } from 'vitest';
import { markTourSeen, TOUR_KEY, TOUR_STEPS, tourSeen, tourSteps } from './tour';

afterEach(() => {
  document.body.innerHTML = '';
  localStorage.setItem(TOUR_KEY, 'seen');
});

describe('tour', () => {
  it('is unseen until marked', () => {
    localStorage.removeItem(TOUR_KEY);
    expect(tourSeen()).toBe(false);
    markTourSeen();
    expect(tourSeen()).toBe(true);
  });

  it('points each step at its part of the board, the card step at the first card', () => {
    document.body.innerHTML = `
      <button data-tour="brand"></button><button data-tour="project"></button>
      <div data-tour="filters"></div>
      <main data-tour="columns"><div role="button" aria-label="T-1 First">a</div><div role="button" aria-label="T-2 Second">b</div></main>
      <button data-tour="add"></button>`;
    const steps = tourSteps();
    expect(steps).toHaveLength(TOUR_STEPS.length);
    expect(steps[0]!.element).toBeUndefined();
    expect((steps[2]!.element as HTMLElement).getAttribute('aria-label')).toBe('T-1 First');
    expect(steps.map((x) => x.popover?.title)).toEqual(TOUR_STEPS.map((x) => x.title));
  });

  it('leaves out steps whose part is not on screen (no cards yet)', () => {
    document.body.innerHTML = '<main data-tour="columns"></main><button data-tour="add"></button>';
    const titles = tourSteps().map((x) => x.popover?.title);
    expect(titles).toEqual(['Welcome to Spec Board', 'The four columns', 'Add a spec']);
  });
});
