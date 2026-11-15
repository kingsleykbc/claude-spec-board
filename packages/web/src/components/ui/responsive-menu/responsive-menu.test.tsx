import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react-vite';
import * as stories from './responsive-menu.stories';

const { Wide, Narrow, ItemOpensModal, ItemOpensModalNarrow, Links, LinksNarrow, KeepOpen, KeepOpenNarrow } = composeStories(stories);

afterEach(cleanup);

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('ResponsiveMenu', () => {
  it('wide: opens a dropdown; an item calls onSelect and the menu closes', async () => {
    const user = userEvent.setup();
    const onSettings = vi.fn();
    render(<Wide onSettings={onSettings} />);
    await user.click(screen.getByRole('button', { name: 'Menu' }));

    const menu = await screen.findByRole('menu');
    expect(within(menu).getByText('Board')).toBeTruthy();
    expect(within(menu).getByRole('menuitem', { name: 'Export (soon)' }).getAttribute('aria-disabled')).toBe('true');
    expect(within(menu).getByRole('menuitemcheckbox', { name: 'Show archived' }).getAttribute('aria-checked')).toBe('true');
    await user.click(within(menu).getByRole('menuitem', { name: 'Settings' }));
    expect(onSettings).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });

  it('wide: a sub opens as a flyout of radio items; picking one checks it and closes the menu', async () => {
    const user = userEvent.setup();
    render(<Wide />);
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Theme' }));
    const system = await screen.findByRole('menuitemradio', { name: 'System' });
    expect(system.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('menuitemradio', { name: 'Dark' }).getAttribute('aria-checked')).toBe('false');

    // By keyboard: happy-dom has no layout, so a pointer moving into the flyout trips its close-on-leave.
    // The ItemOpensModal stories pick with the pointer in a real browser.
    screen.getByRole('menuitemradio', { name: 'Dark' }).focus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Theme' }));
    expect((await screen.findByRole('menuitemradio', { name: 'Dark' })).getAttribute('aria-checked')).toBe('true');
  });

  it('narrow: opens a drawer titled with the menu title, and a sub shows as a group', async () => {
    const user = userEvent.setup();
    const onSync = vi.fn();
    render(<Narrow onSync={onSync} />);
    await user.click(screen.getByRole('button', { name: 'Menu' }));

    const sheet = await screen.findByRole('dialog', { name: 'Board menu' });
    const group = within(sheet).getByRole('group', { name: 'Theme' });
    expect(within(group).getByRole('menuitemradio', { name: 'System' }).getAttribute('aria-checked')).toBe('true');
    expect(within(sheet).getByRole('menuitemcheckbox', { name: 'Show archived' }).getAttribute('aria-checked')).toBe('true');
    expect(within(sheet).getByRole('menuitem', { name: 'Export (soon)' }).hasAttribute('disabled')).toBe(true);
    expect(within(sheet).getByRole('separator')).toBeTruthy();

    await user.click(within(sheet).getByRole('menuitem', { name: 'Sync with Claude' }));
    expect(onSync).toHaveBeenCalledTimes(1);
    // Picking closes the drawer at once (no slide-out), so nothing of it is left on the page.
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Menu' }).getAttribute('aria-expanded')).toBe('false');
  });

  it('narrow: a radio item checks its value and closes the drawer', async () => {
    const user = userEvent.setup();
    render(<Narrow />);
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    const sheet = await screen.findByRole('dialog', { name: 'Board menu' });
    await user.click(within(sheet).getByRole('menuitemradio', { name: 'Light' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    const again = await screen.findByRole('dialog', { name: 'Board menu' });
    expect(within(again).getByRole('menuitemradio', { name: 'Light' }).getAttribute('aria-checked')).toBe('true');
    expect(within(again).getByRole('menuitemradio', { name: 'System' }).getAttribute('aria-checked')).toBe('false');
  });

  it('wide: an item that opens a modal leaves focus inside the modal', async () => {
    const user = userEvent.setup();
    render(<ItemOpensModal />);
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Settings' }));
    const dlg = await screen.findByRole('dialog', { name: 'Settings' });
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    await tick(50);
    expect(dlg.contains(document.activeElement)).toBe(true);
  });

  it('wide: an item that opens nothing returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<Wide />);
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Settings' }));
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    await tick(50);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Menu' }));
  });

  it('narrow: an item that opens a modal leaves focus inside the modal', async () => {
    const user = userEvent.setup();
    render(<ItemOpensModalNarrow />);
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    const sheet = await screen.findByRole('dialog', { name: 'Board menu' });
    await user.click(within(sheet).getByRole('menuitem', { name: 'Settings' }));
    const dlg = await screen.findByRole('dialog', { name: 'Settings' });
    await tick(50);
    expect(dlg.contains(document.activeElement)).toBe(true);
  });

  it('narrow: restores matchMedia after the story unmounts', () => {
    const before = window.matchMedia;
    const { unmount } = render(<Narrow />);
    expect(window.matchMedia('(max-width: 720px)').matches).toBe(true);
    unmount();
    expect(window.matchMedia).toBe(before);
  });

  it.each([
    ['wide', Links],
    ['narrow', LinksNarrow],
  ] as const)('%s: link items keep href, target and aria-current, and close the menu when followed', async (_, Story) => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Story onSelect={onSelect} />);
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    const docs = await screen.findByRole('menuitem', { name: 'Documentation' });
    expect(docs.tagName).toBe('A');
    expect(docs.getAttribute('href')).toBe('/docs');
    expect(docs.getAttribute('target')).toBe('_blank');
    expect(docs.getAttribute('rel')).toBe('noopener');
    const board = screen.getByRole('menuitem', { name: 'Board' });
    expect(board.getAttribute('aria-current')).toBe('page');
    expect(board.getAttribute('target')).toBeNull();
    // Keep happy-dom from following the link; on window, so it runs after React's own click handling.
    const stay = (e: Event) => e.preventDefault();
    window.addEventListener('click', stay);
    await user.click(docs);
    window.removeEventListener('click', stay);
    expect(onSelect).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'Documentation' })).toBeNull());
  });

  it('wide: the dropdown is named by the menu title', async () => {
    const user = userEvent.setup();
    render(<Wide />);
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    expect(await screen.findByRole('menu', { name: 'Board menu' })).toBeTruthy();
  });

  it.each([
    ['wide', KeepOpen],
    ['narrow', KeepOpenNarrow],
  ])('%s: a keepOpen item can be ticked again and again without the menu closing', async (_, Story) => {
    const user = userEvent.setup();
    render(<Story />);
    await user.click(screen.getByRole('button', { name: 'Fruit' }));
    const menu = await screen.findByRole('menu', { name: 'Fruit' });
    await user.click(within(menu).getByRole('menuitemcheckbox', { name: 'Apple' }));
    await user.click(within(menu).getByRole('menuitemcheckbox', { name: 'Pear' }));
    await tick(50);
    expect(screen.getByRole('menu', { name: 'Fruit' })).toBe(menu);
    expect(within(menu).getAllByRole('menuitemcheckbox').map((x) => x.getAttribute('aria-checked'))).toEqual(['true', 'true']);
  });
});
