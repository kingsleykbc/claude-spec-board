import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
