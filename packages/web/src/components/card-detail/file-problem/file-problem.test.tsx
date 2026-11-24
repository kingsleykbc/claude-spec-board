import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { composeStories } from '@storybook/react-vite';
import * as stories from './file-problem.stories';

const { Default } = composeStories(stories);

afterEach(cleanup);

describe('FileProblem', () => {
  it('shows the message and path and the fix button', () => {
    const onFix = vi.fn();
    render(<Default message="Bad line" path="specs/a.md" onFix={onFix} />);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('This spec file has a formatting problem')).toBeTruthy();
    expect(screen.getByText('Bad line')).toBeTruthy();
    expect(screen.getByText('specs/a.md')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ask Claude to fix' }));
    expect(onFix).toHaveBeenCalled();
  });
});

describe('FileProblem: Starting…', () => {
  it('Ask Claude to fix says Starting…, disabled, until its start settles', async () => {
    let settle!: (ok: boolean) => void;
    const onFix = vi.fn(() => new Promise<boolean>((r) => (settle = r)));
    render(<Default message="Bad line" path="specs/a.md" onFix={onFix} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ask Claude to fix' }));
    const btn = screen.getByRole('button', { name: 'Starting…' });
    expect(btn).toHaveProperty('disabled', true);
    fireEvent.click(btn);
    expect(onFix).toHaveBeenCalledOnce();
    await act(async () => settle(false));
    expect(screen.getByRole('button', { name: 'Ask Claude to fix' })).toHaveProperty('disabled', false);
  });
});
