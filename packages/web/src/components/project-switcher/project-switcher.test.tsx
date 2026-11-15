import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { composeStories } from '@storybook/react-vite';
import * as stories from './project-switcher.stories';
import { progressText } from './project-switcher';

const { Closed, Open, Reconnecting, Disconnected, NoConnection, Narrow } = composeStories(stories);

afterEach(cleanup);

describe('ProjectSwitcher', () => {
  it('shows the project, its progress and the live state', () => {
    render(<Closed />);
    expect(screen.getByRole('button', { name: /Recipe Box/ }).textContent).toBe('Recipe Box3/9 done');
    expect(screen.getByTestId('conn').textContent).toBe('');
    expect(screen.queryByText('Live')).toBeNull();
    expect(screen.getByTestId('conn').title).toBe('Connected. Watching specs/ for changes.');
    expect(screen.queryByTestId('spinner')).toBeNull();
  });

  it('Reconnecting… has a spinner; Disconnected a red dot; live a green one', () => {
    render(<Reconnecting />);
    expect(screen.getByTestId('conn').title).toBe('Not connected to the local server');
    expect(screen.getByTestId('spinner')).toBeTruthy();
    cleanup();
    render(<Disconnected />);
    expect(screen.getByTestId('conn').title).toBe('Not connected to the local server');
    expect(screen.getByTestId('conn').firstElementChild!.getAttribute('style')).toContain('var(--block)');
    cleanup();
    render(<Closed />);
    expect(screen.getByTestId('conn').firstElementChild!.getAttribute('style')).toContain('var(--done)');
  });

  it('has no dot without a connection (the docs page)', () => {
    render(<NoConnection />);
    expect(screen.queryByTestId('conn')).toBeNull();
  });

  it('lists projects with progress and a tick', () => {
    const onPick = vi.fn();
    const onOpenFolder = vi.fn();
    render(<Open onPick={onPick} onOpenFolder={onOpenFolder} />);
    expect(screen.getByText('PROJECTS')).toBeTruthy();
    const items = screen.getAllByRole('menuitemradio');
    expect(items.map((i) => i.getAttribute('aria-checked'))).toEqual(['true', 'false']);
    expect(items[1]!.textContent).toBe('Empty~/code/emptyNo specs yet');
    fireEvent.click(items[1]!);
    expect(onPick).toHaveBeenCalledWith('p2');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Open another project folder…' }));
    expect(onOpenFolder).toHaveBeenCalled();
  });

  it('each project in the list has a dot: green and "Folder found", or grey and "Folder missing"', () => {
    render(<Open />);
    const a = screen.getByTestId('avail-p1');
    const b = screen.getByTestId('avail-p2');
    expect(a.title).toBe('Folder found');
    expect(a.getAttribute('style')).toContain('var(--done)');
    expect(b.title).toBe('Folder missing');
    expect(b.getAttribute('style')).toContain('var(--fg3)');
  });

  it('opens and closes on click', () => {
    render(<Closed />);
    const btn = screen.getByRole('button', { name: /Recipe Box/ });
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(btn);
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.click(btn);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('narrow: keeps the dot, drops the progress text', () => {
    render(<Narrow />);
    expect(screen.getByTestId('conn')).toBeTruthy();
    expect(screen.queryByText('3/9 done')).toBeNull();
  });

  it('progressText', () => {
    expect(progressText({ done: 0, total: 0 })).toBe('No specs yet');
    expect(progressText({ done: 2, total: 5 })).toBe('2/5 done');
  });
});
