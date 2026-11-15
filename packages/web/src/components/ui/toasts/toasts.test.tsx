import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { composeStories } from '@storybook/react-vite';
import * as stories from './toasts.stories';
import { TOAST } from '@/state/toasts';

const { AllKinds, Two } = composeStories(stories);

afterEach(cleanup);

describe('Toasts', () => {
  it('renders each kind with its icon and dismisses', () => {
    const onDismiss = vi.fn();
    render(<Two onDismiss={onDismiss} />);
    const icons = [...document.querySelectorAll('[data-kind]')].map((t) => t.firstElementChild!.innerHTML);
    expect(icons).toEqual([renderToStaticMarkup(<TOAST.ok.icon aria-hidden />), renderToStaticMarkup(<TOAST.err.icon aria-hidden />)]);
    expect(screen.getByText('Meal planner calendar')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Dismiss' })[1]!);
    expect(onDismiss).toHaveBeenCalledWith(2);
  });

  it('gives every kind its own icon', () => {
    render(<AllKinds />);
    const icons = [...document.querySelectorAll('[data-kind] > span:first-child')].map((x) => x.innerHTML);
    expect(icons).toHaveLength(5);
    expect(new Set(icons).size).toBe(5);
    expect(screen.getAllByRole('button', { name: 'Dismiss' })).toHaveLength(5);
  });
});
