import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { composeStories } from '@storybook/react-vite';
import * as stories from './urgency-control.stories';

const { Default } = composeStories(stories);

afterEach(cleanup);

describe('UrgencyControl', () => {
  it('lists Low to Urgent with the current one checked, and reports a different pick', () => {
    const onPick = vi.fn();
    render(<Default value="normal" onPick={onPick} />);
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.textContent)).toEqual(['Low', 'Normal', 'High', 'Urgent']);
    expect(radios[1]!.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(radios[1]!);
    expect(onPick).not.toHaveBeenCalled();
    fireEvent.click(radios[0]!);
    expect(onPick).toHaveBeenCalledWith('low');
  });
});
