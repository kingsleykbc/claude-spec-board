import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { composeStories } from '@storybook/react-vite';
import * as stories from './log-meta.stories';

const { Full, PlainPr, TokensOnly } = composeStories(stories);

afterEach(cleanup);

describe('LogMeta', () => {
  it('shows files, commit, a PR link and tokens', () => {
    render(<Full />);
    expect(screen.getByText('FILES CHANGED')).toBeTruthy();
    expect(screen.getByText('src/pages/Planner.tsx')).toBeTruthy();
    expect(screen.getByText('COMMIT')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'PR' }).getAttribute('href')).toBe('https://github.com/o/r/pull/7');
    expect(screen.getByTestId('log-meta').textContent).toContain('48.2k tokens');
  });

  it('shows a PR that is not an http URL as text, not a link', () => {
    render(<PlainPr />);
    expect(screen.queryByRole('link', { name: 'PR' })).toBeNull();
    expect(screen.getByText('#7 (local)')).toBeTruthy();
  });

  it('leaves out what is empty', () => {
    render(<TokensOnly />);
    expect(screen.queryByText('FILES CHANGED')).toBeNull();
    expect(screen.queryByText('COMMIT')).toBeNull();
    expect(screen.getByText('48.2k tokens')).toBeTruthy();
  });
});
