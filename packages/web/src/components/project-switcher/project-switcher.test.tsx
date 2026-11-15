import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react-vite';
import * as stories from './project-switcher.stories';
import { progressText } from './project-switcher';

const { Closed, Reconnecting, Disconnected, NoConnection, Narrow } = composeStories(stories);

afterEach(cleanup);

async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Recipe Box/ }));
  return screen.findByRole('menu');
}

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
    expect(screen.getByTestId('conn').firstElementChild!.className).toMatch(/\bbg-block\b/);
    cleanup();
    render(<Closed />);
    expect(screen.getByTestId('conn').firstElementChild!.className).toMatch(/\bbg-done\b/);
  });

  it('has no dot without a connection (the docs page)', () => {
    render(<NoConnection />);
    expect(screen.queryByTestId('conn')).toBeNull();
  });

  it('lists projects with progress and a tick; picking calls onPick and closes the menu', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const onOpen = vi.fn();
    render(<Closed onPick={onPick} onOpen={onOpen} />);
    const menu = await open(user);
    expect(onOpen).toHaveBeenCalledOnce();
    expect(within(menu).getByText('PROJECTS')).toBeTruthy();
    const items = within(menu).getAllByRole('menuitemradio');
    expect(items.map((i) => i.getAttribute('aria-checked'))).toEqual(['true', 'false']);
    expect(items[0]!.querySelector('svg')).toBeTruthy();
    expect(items[1]!.textContent).toBe('Empty~/code/emptyNo specs yet');
    await user.click(items[1]!);
    expect(onPick).toHaveBeenCalledWith('p2');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });

  it('"Open another project folder…" calls onOpenFolder', async () => {
    const user = userEvent.setup();
    const onOpenFolder = vi.fn();
    render(<Closed onOpenFolder={onOpenFolder} />);
    await open(user);
    await user.click(screen.getByRole('menuitem', { name: 'Open another project folder…' }));
    expect(onOpenFolder).toHaveBeenCalledOnce();
  });

  it('each project in the list has a dot: green and "Folder found", or grey and "Folder missing"', async () => {
    const user = userEvent.setup();
    render(<Closed />);
    await open(user);
    const a = screen.getByTestId('avail-p1');
    const b = screen.getByTestId('avail-p2');
    expect(a.title).toBe('Folder found');
    expect(a.className).toMatch(/\bbg-done\b/);
    expect(b.title).toBe('Folder missing');
    expect(b.className).toMatch(/\bbg-fg3\b/);
  });

  it('Esc closes the menu', async () => {
    const user = userEvent.setup();
    render(<Closed />);
    await open(user);
    expect(screen.getByRole('button', { name: /Recipe Box/ }).getAttribute('aria-expanded')).toBe('true');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });

  it('narrow (720px): keeps the dot, drops the progress text, and opens as a drawer', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<Narrow onPick={onPick} />);
    expect(screen.getByTestId('conn')).toBeTruthy();
    expect(screen.queryByText('3/9 done')).toBeNull();
    await user.click(screen.getByRole('button', { name: /Recipe Box/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Projects' });
    const items = within(sheet).getAllByRole('menuitemradio');
    expect(items.map((i) => i.getAttribute('aria-checked'))).toEqual(['true', 'false']);
    expect(items[1]!.textContent).toBe('Empty~/code/emptyNo specs yet');
    expect(within(sheet).getByRole('menuitem', { name: 'Open another project folder…' })).toBeTruthy();
    await user.click(items[1]!);
    expect(onPick).toHaveBeenCalledWith('p2');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('progressText', () => {
    expect(progressText({ done: 0, total: 0 })).toBe('No specs yet');
    expect(progressText({ done: 2, total: 5 })).toBe('2/5 done');
  });
});
