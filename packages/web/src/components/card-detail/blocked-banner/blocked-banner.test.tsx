import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { composeStories } from '@storybook/react-vite';
import * as stories from './blocked-banner.stories';

const { Default } = composeStories(stories);

afterEach(cleanup);

describe('BlockedBanner', () => {
  it('renders each reason as a button', () => {
    const a = vi.fn();
    render(<Default reasons={[{ key: 'q', text: 'Awaiting answers on: X', onClick: a }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Awaiting answers on: X' }));
    expect(a).toHaveBeenCalled();
    expect(within(screen.getByRole('status')).getByText('!')).toBeTruthy();
    expect(within(screen.getByRole('status')).getByText('Blocked.')).toBeTruthy();
  });
});
