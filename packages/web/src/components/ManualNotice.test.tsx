import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ManualNotice } from './ManualNotice';

afterEach(cleanup);

const LINES = {
  'not-installed': "Claude Code isn't installed on this computer.",
  'not-logged-in': "Claude Code isn't logged in.",
  blocked: 'Claude Code is blocked by a setting.',
  'not-approved': "This project isn't set up for background runs.",
} as const;

describe('ManualNotice', () => {
  it('renders nothing when there is no reason', () => {
    const { container } = render(<ManualNotice reason={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('is a closed button until clicked', () => {
    render(<ManualNotice reason="not-approved" />);
    expect(screen.getByRole('button', { name: 'Manual mode: background runs are off' }).textContent).toContain('Manual');
    expect(screen.queryByText('Manual mode (non-agentic)')).toBeNull();
  });

  it.each(Object.entries(LINES))('opens and shows the %s line and the docs link', (reason, line) => {
    render(<ManualNotice reason={reason as keyof typeof LINES} />);
    fireEvent.click(screen.getByRole('button', { name: 'Manual mode: background runs are off' }));
    expect(screen.getByText('Manual mode (non-agentic)')).toBeTruthy();
    expect(screen.getByText("The board can't run Claude for you here, so use the Copy command buttons and paste them into a Claude chat.")).toBeTruthy();
    expect(screen.getByText(line)).toBeTruthy();
    const link = screen.getByRole('link', { name: 'How to turn on background runs' });
    expect(link.getAttribute('href')).toBe('/docs/running-specs#turn-on-background-runs');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('closes on Esc and on an outside click', () => {
    render(<ManualNotice reason="blocked" />);
    const btn = screen.getByRole('button', { name: 'Manual mode: background runs are off' });
    fireEvent.click(btn);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Manual mode (non-agentic)')).toBeNull();
    fireEvent.click(btn);
    fireEvent.click(screen.getByTestId('manual-scrim'));
    expect(screen.queryByText('Manual mode (non-agentic)')).toBeNull();
  });

  it('toggles closed on a second click', () => {
    render(<ManualNotice reason="blocked" />);
    const btn = screen.getByRole('button', { name: 'Manual mode: background runs are off' });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(screen.queryByText('Manual mode (non-agentic)')).toBeNull();
  });
});
