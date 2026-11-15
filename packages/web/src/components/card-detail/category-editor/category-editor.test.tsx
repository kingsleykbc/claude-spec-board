import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react-vite';
import { categorySuggestions } from './category-editor';
import * as stories from './category-editor.stories';

const { Default } = composeStories(stories);

afterEach(cleanup);

describe('CategoryEditor', () => {
  it('categorySuggestions filters by substring, skips the spec’s own, and offers Create for new text', () => {
    const all = ['Frontend', 'Backend', 'Auth', 'Infra'];
    expect(categorySuggestions(all, ['Frontend'], '')).toEqual([
      { name: 'Backend', label: 'Backend' },
      { name: 'Auth', label: 'Auth' },
      { name: 'Infra', label: 'Infra' },
    ]);
    expect(categorySuggestions(all, ['Frontend'], 'END')).toEqual([
      { name: 'Backend', label: 'Backend' },
      { name: 'END', label: 'Create “END”' },
    ]);
    expect(categorySuggestions(all, [], ' Payments ')).toEqual([{ name: 'Payments', label: 'Create “Payments”' }]);
    expect(categorySuggestions(all, ['Frontend'], 'frontend')).toEqual([]);
  });

  it('shows "Type a new category name" when nothing matches, and closes on blur', () => {
    render(<Default categories={['Frontend']} all={['Frontend']} />);
    fireEvent.click(screen.getByRole('button', { name: 'Category' }));
    expect(screen.getByText('Type a new category name')).toBeTruthy();
    fireEvent.blur(screen.getByPlaceholderText('Category…'));
    expect(screen.queryByPlaceholderText('Category…')).toBeNull();
  });

  it('Enter uses an existing category’s spelling', () => {
    const onAdd = vi.fn();
    render(<Default categories={[]} all={['Infra']} onAdd={onAdd} />);
    fireEvent.click(screen.getByRole('button', { name: 'Category' }));
    const input = screen.getByPlaceholderText('Category…');
    fireEvent.change(input, { target: { value: 'infra' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onAdd).toHaveBeenCalledWith('Infra');
  });

  it('the × on a chip has a tooltip and removes that category', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<Default onRemove={onRemove} />);
    const x = screen.getByRole('button', { name: 'Remove category Frontend' });
    await user.hover(x);
    await waitFor(() => expect(screen.getByRole('tooltip').textContent).toBe('Remove category Frontend'));
    await user.click(x);
    expect(onRemove).toHaveBeenCalledWith('Frontend');
  });
});
