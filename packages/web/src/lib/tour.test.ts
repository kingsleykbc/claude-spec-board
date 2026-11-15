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
      <div data-tour="filters"></div><label data-tour="simple"></label>
      <main data-tour="columns"><div role="button" aria-label="T-1 First">a</div><div role="button" aria-label="T-2 Second">b</div></main>
      <button data-tour="add"></button>`;
    const steps = tourSteps();
    expect(steps).toHaveLength(TOUR_STEPS.length);
    expect(steps[0]!.element).toBeUndefined();
    expect((steps[2]!.element as HTMLElement).getAttribute('aria-label')).toBe('T-1 First');
    expect(steps.map((x) => x.popover?.title)).toEqual(TOUR_STEPS.map((x) => x.title));
  });

  it('the filters step mentions the Board | Table switch; Simple mode has its own step', () => {
    expect(TOUR_STEPS).toHaveLength(8);
    expect(TOUR_STEPS.find((x) => x.target === 'filters')!.text).toContain('Switch between Board and Table');
    expect(TOUR_STEPS.find((x) => x.target === 'filters')!.text).not.toContain('Simple mode');
  });

  it('the Simple mode step points at the switch in the header, or at the logo menu when the switch is not shown (small screens)', () => {
    document.body.innerHTML = '<button data-tour="brand"></button><label data-tour="simple"></label>';
    let st = tourSteps().find((x) => x.popover?.title === 'Simple mode')!;
    expect((st.element as HTMLElement).dataset.tour).toBe('simple');
    expect(st.popover?.description).toContain('hides the extra detail');
    document.body.innerHTML = '<button data-tour="brand"></button>';
    st = tourSteps().find((x) => x.popover?.title === 'Simple mode')!;
    expect((st.element as HTMLElement).dataset.tour).toBe('brand');
    expect(st.popover?.description).toBe('<b>Simple mode</b> is in this menu on small screens. It hides the extra detail when you just want to follow the work.');
  });

  it('in Simple mode the References step points at the logo menu, with its own text, and keeps 8 steps', () => {
    document.body.innerHTML = '<button data-tour="brand"></button><div data-tour="filters"></div><main data-tour="columns"></main><button data-tour="add"></button>';
    const steps = tourSteps(document, true);
    const i = steps.findIndex((x) => x.popover?.title === 'References, Overview and Logs');
    expect((steps[i]!.element as HTMLElement).dataset.tour).toBe('brand');
    expect(steps[i]!.popover?.description).toBe('References and Overview are in this menu in Simple mode. Logs stays at the right of the header.');
    expect(TOUR_STEPS).toHaveLength(8);
  });

  it('in normal mode that step keeps the References button and mentions Logs', () => {
    expect(TOUR_STEPS.find((x) => x.target === 'project')!.text).toContain('Logs');
  });

  it('leaves out steps whose part is not on screen (no cards yet)', () => {
    document.body.innerHTML = '<main data-tour="columns"></main><button data-tour="add"></button>';
    const titles = tourSteps().map((x) => x.popover?.title);
    expect(titles).toEqual(['Welcome to Spec Board', 'The four columns', 'Add a spec']);
  });
});
