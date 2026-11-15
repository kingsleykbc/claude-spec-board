import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react-vite';
import * as stories from './top-bar.stories';

const { Live, Simple, Narrow, DocsPage, NotConnected, Reconnecting } = composeStories(stories);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

/** The header's own buttons, by name, left to right (switches are not buttons). */
const headerButtons = () => within(screen.getByRole('banner')).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent);

async function openLogoMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Spec Board' }));
  return screen.findByRole('menu');
}

describe('the header', () => {
  it('orders the right side: not-connected, References, Overview, Simple mode, Logs', () => {
    render(<NotConnected />);
    const header = screen.getByRole('banner');
    const els = [
      within(header).getByRole('button', { name: "Claude isn't connected to the board" }),
      within(header).getByRole('button', { name: 'References' }),
      within(header).getByRole('button', { name: 'Overview' }),
      within(header).getByRole('switch', { name: 'Simple mode' }),
      within(header).getByRole('button', { name: 'Logs' }),
    ];
    for (let i = 0; i < els.length - 1; i++) expect(els[i]!.compareDocumentPosition(els[i + 1]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows the logo at 26px', () => {
    render(<Live />);
    const img = screen.getByRole('button', { name: 'Spec Board' }).querySelector('img')!;
    expect(img.getAttribute('width')).toBe('26');
    expect(img.getAttribute('height')).toBe('26');
  });
});

describe('the menu under the logo', () => {
  it('shows the new logo beside "Spec Board", and stays closed until asked', async () => {
    const user = userEvent.setup();
    render(<Live />);
    const brand = screen.getByRole('button', { name: 'Spec Board' });
    expect(brand.querySelector('img')!.getAttribute('src')).toMatch(/spec-board-logo/);
    expect(brand.getAttribute('data-tour')).toBe('brand');
    expect(screen.queryByRole('menuitem', { name: 'Documentation' })).toBeNull();
    await openLogoMenu(user);
    expect(screen.getByRole('menuitem', { name: 'Documentation' })).toBeTruthy();
  });

  it('opens the documentation in a new tab, so unsaved work on the board is safe', async () => {
    const user = userEvent.setup();
    render(<Live />);
    await openLogoMenu(user);
    const item = screen.getByRole('menuitem', { name: 'Documentation' });
    expect(item.getAttribute('href')).toBe('/docs?project=p1');
    expect(item.getAttribute('target')).toBe('_blank');
  });

  it('lists Documentation, Take the tour, Sync with code and Settings, then a separator and Theme', async () => {
    const user = userEvent.setup();
    render(<Live />);
    const menu = await openLogoMenu(user);
    expect(within(menu).getAllByRole('menuitem').map((m) => m.textContent?.trim())).toEqual(['Documentation', 'Take the tour', 'Sync with code', 'Settings', 'Theme']);
    expect(within(menu).getAllByRole('separator')).toHaveLength(1);
    const order = [...menu.querySelectorAll('[role="menuitem"], [role="separator"]')].map((c) => c.textContent?.trim() || c.getAttribute('role'));
    expect(order.slice(-2)).toEqual(['separator', 'Theme']);
  });

  it('"Sync with code" calls onSync and closes the menu; no waiting item unless one is waiting', async () => {
    const user = userEvent.setup();
    const onSync = vi.fn();
    render(<Live onSync={onSync} />);
    await openLogoMenu(user);
    expect(screen.queryByRole('menuitem', { name: /Sync proposal waiting/ })).toBeNull();
    await user.click(screen.getByRole('menuitem', { name: 'Sync with code' }));
    expect(onSync).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });

  it('"Sync proposal waiting" shows only when a proposal is waiting, and reopens it', async () => {
    const user = userEvent.setup();
    const onSyncWaiting = vi.fn();
    render(<Live syncWaiting onSyncWaiting={onSyncWaiting} />);
    await openLogoMenu(user);
    await user.click(screen.getByRole('menuitem', { name: /Sync proposal waiting/ }));
    expect(onSyncWaiting).toHaveBeenCalledOnce();
  });

  it('Settings and the tour are menu items that call their actions', async () => {
    const user = userEvent.setup();
    const onSettings = vi.fn();
    const onTour = vi.fn();
    render(<Live onSettings={onSettings} onTour={onTour} />);
    await openLogoMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Settings' }));
    expect(onSettings).toHaveBeenCalledOnce();
    await openLogoMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Take the tour' }));
    expect(onTour).toHaveBeenCalledOnce();
  });
});

describe('the Theme submenu', () => {
  it('has Light, Dark and System; picking Dark sets data-theme="dark" and saves dark', async () => {
    const user = userEvent.setup();
    const onTheme = vi.fn();
    render(<Live onTheme={onTheme} />);
    await openLogoMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Theme' }));
    const radios = await screen.findAllByRole('menuitemradio');
    expect(radios.map((r) => r.textContent?.trim())).toEqual(['Light', 'Dark', 'System']);
    expect(screen.getByRole('menuitemradio', { name: 'Light' }).getAttribute('aria-checked')).toBe('true');
    // By keyboard: happy-dom has no layout, so a pointer moving into the flyout trips its close-on-leave.
    screen.getByRole('menuitemradio', { name: 'Dark' }).focus();
    await user.keyboard('{Enter}');
    expect(onTheme).toHaveBeenCalledWith('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('specboard.theme')).toBe('dark');
  });
});

describe('the header buttons', () => {
  it('regular mode: Simple mode switch, then References, Overview and Logs with icons; Logs is last', () => {
    render(<Live />);
    expect(headerButtons()).toEqual(['Spec Board', 'Recipe Box3/9 done', 'References', 'Overview', 'Logs']);
    for (const n of ['References', 'Overview', 'Logs']) expect(screen.getByRole('button', { name: n }).querySelector('svg')).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Simple mode' }).getAttribute('aria-checked')).toBe('false');
  });

  it('References, Overview and Logs call their actions', async () => {
    const user = userEvent.setup();
    const onOpenRefs = vi.fn();
    const onOpenOverview = vi.fn();
    const onOpenLogs = vi.fn();
    render(<Live onOpenRefs={onOpenRefs} onOpenOverview={onOpenOverview} onOpenLogs={onOpenLogs} />);
    await user.click(screen.getByRole('button', { name: 'References' }));
    await user.click(screen.getByRole('button', { name: 'Overview' }));
    await user.click(screen.getByRole('button', { name: 'Logs' }));
    expect(onOpenRefs).toHaveBeenCalledOnce();
    expect(onOpenOverview).toHaveBeenCalledOnce();
    expect(onOpenLogs).toHaveBeenCalledOnce();
  });

  it('regular mode: the menu does not repeat References, Overview or Logs', async () => {
    const user = userEvent.setup();
    render(<Live />);
    await openLogoMenu(user);
    for (const n of ['References', 'Overview', 'Logs', 'Simple mode']) expect(screen.queryByRole('menuitem', { name: n })).toBeNull();
  });

  it('the Simple mode switch is in the top bar and toggles Simple mode', async () => {
    const user = userEvent.setup();
    const onSimple = vi.fn();
    render(<Live onSimple={onSimple} />);
    const sw = within(screen.getByRole('banner')).getByRole('switch', { name: 'Simple mode' });
    expect(sw.closest('[data-tour="simple"]')).toBeTruthy();
    await user.click(sw);
    expect(onSimple).toHaveBeenCalledWith(true);
    expect(sw.getAttribute('aria-checked')).toBe('true');
    expect(screen.queryByRole('button', { name: 'References' })).toBeNull();
    await user.click(sw);
    expect(onSimple).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole('button', { name: 'References' })).toBeTruthy();
  });
});

describe('Simple mode', () => {
  it('Logs is still in the header and the last button; References and Overview are in the menu', async () => {
    const user = userEvent.setup();
    const onOpenRefs = vi.fn();
    const onOpenOverview = vi.fn();
    render(<Simple onOpenRefs={onOpenRefs} onOpenOverview={onOpenOverview} />);
    expect(headerButtons()).toEqual(['Spec Board', 'Recipe Box3/9 done', "Claude isn't connected to the board", 'Logs']);
    const menu = await openLogoMenu(user);
    expect(within(menu).getAllByRole('menuitem').map((m) => m.textContent?.trim())).toEqual([
      'Documentation',
      'Take the tour',
      'Sync with code',
      'Settings',
      'References',
      'Overview',
      'Theme',
    ]);
    expect(screen.queryByRole('menuitem', { name: 'Logs' })).toBeNull();
    await user.click(screen.getByRole('menuitem', { name: 'References' }));
    expect(onOpenRefs).toHaveBeenCalledOnce();
    await openLogoMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Overview' }));
    expect(onOpenOverview).toHaveBeenCalledOnce();
  });
});

describe('the not-connected icon', () => {
  it('shows only when runs are off, before References, as the not-connected picture', () => {
    render(<Live />);
    expect(screen.queryByRole('button', { name: "Claude isn't connected to the board" })).toBeNull();
    cleanup();
    render(<NotConnected />);
    const btn = screen.getByRole('button', { name: "Claude isn't connected to the board" });
    expect(btn.querySelector('img')!.getAttribute('src')).toMatch(/not-connected/);
    expect(btn.compareDocumentPosition(screen.getByRole('button', { name: 'References' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('opens a popover with the exact title', async () => {
    const user = userEvent.setup();
    render(<NotConnected />);
    await user.click(screen.getByRole('button', { name: "Claude isn't connected to the board" }));
    const pop = await screen.findByRole('dialog', { name: "Claude isn't connected to the board" });
    expect(within(pop).getByText("Claude isn't connected to the board")).toBeTruthy();
    expect(within(pop).getByText("This project isn't set up for background runs.")).toBeTruthy();
  });

  it('no "Manual" or "non-agentic" anywhere in the header, its menu or the popover', async () => {
    const user = userEvent.setup();
    render(<Simple />);
    const bad = /manual|non-agentic/i;
    expect(screen.getByRole('banner').textContent).not.toMatch(bad);
    for (const el of screen.getByRole('banner').querySelectorAll('[aria-label],[title]')) {
      expect(`${el.getAttribute('aria-label') ?? ''} ${el.getAttribute('title') ?? ''}`).not.toMatch(bad);
    }
    await user.click(screen.getByRole('button', { name: "Claude isn't connected to the board" }));
    expect((await screen.findByRole('dialog')).textContent).not.toMatch(bad);
    await user.keyboard('{Escape}');
    const menu = await openLogoMenu(user);
    expect(menu.textContent).not.toMatch(bad);
  });
});

describe('small screens', () => {
  it('Logs stays in the header, icon-only, named "Logs", and last', async () => {
    const user = userEvent.setup();
    const onOpenLogs = vi.fn();
    render(<Narrow onOpenLogs={onOpenLogs} />);
    const logs = screen.getByRole('button', { name: 'Logs' });
    expect(logs.textContent).toBe('');
    expect(logs.querySelector('svg')).toBeTruthy();
    expect(headerButtons().at(-1)).toBe('Logs');
    await user.click(logs);
    expect(onOpenLogs).toHaveBeenCalledOnce();
  });

  it('References, Overview and the Simple mode toggle move into the logo menu (a drawer) and work', async () => {
    const user = userEvent.setup();
    const onOpenRefs = vi.fn();
    const onSimple = vi.fn();
    render(<Narrow onOpenRefs={onOpenRefs} onSimple={onSimple} />);
    expect(screen.queryByRole('button', { name: 'References' })).toBeNull();
    expect(screen.queryByRole('switch', { name: 'Simple mode' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Spec Board' }));
    const sheet = await screen.findByRole('dialog', { name: 'Spec Board' });
    const names = [...sheet.querySelectorAll('[role^="menuitem"]')].map((m) => m.textContent?.trim());
    expect(names).toEqual(['Documentation', 'Take the tour', 'Sync with code', 'Settings', 'References', 'Overview', 'Simple mode', 'Light', 'Dark', 'System']);
    expect(within(sheet).queryByRole('menuitem', { name: 'Logs' })).toBeNull();
    await user.click(within(sheet).getByRole('menuitemcheckbox', { name: 'Simple mode' }));
    expect(onSimple).toHaveBeenCalledWith(true);
    await user.click(screen.getByRole('button', { name: 'Spec Board' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Spec Board' })).getByRole('menuitem', { name: 'References' }));
    expect(onOpenRefs).toHaveBeenCalledOnce();
  });

  it('the not-connected icon stays in the header', () => {
    render(<Narrow />);
    expect(screen.getByRole('button', { name: "Claude isn't connected to the board" })).toBeTruthy();
  });

  it('the switcher keeps its dot but drops the progress text', () => {
    render(<Narrow />);
    expect(screen.getByTestId('conn')).toBeTruthy();
    expect(screen.queryByText(/3.*9/)).toBeNull();
  });

  it('with no matchMedia at all it behaves as wide', () => {
    vi.stubGlobal('matchMedia', undefined);
    render(<Live />);
    expect(screen.getByRole('button', { name: 'References' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Logs' }).textContent).toBe('Logs');
  });
});

describe('the top bar on the docs page', () => {
  it('keeps the logo and project, drops References, Overview, Logs, Simple mode and Live, and links back to the board', () => {
    render(<DocsPage />);
    expect(screen.getByRole('button', { name: 'Spec Board' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Recipe Box/ })).toBeTruthy();
    for (const n of ['References', 'Overview', 'Logs']) expect(screen.queryByRole('button', { name: n })).toBeNull();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByTestId('conn')).toBeNull();
    expect(screen.getByRole('link', { name: 'Open the board' }).getAttribute('href')).toBe('/?project=p1');
  });

  it('its logo menu goes to the board, marks Documentation as this page in this tab, and has Theme after a separator', async () => {
    const user = userEvent.setup();
    render(<DocsPage />);
    const menu = await openLogoMenu(user);
    expect(within(menu).getByRole('menuitem', { name: 'Board' }).getAttribute('href')).toBe('/?project=p1');
    const here = within(menu).getByRole('menuitem', { name: 'Documentation' });
    expect(here.getAttribute('aria-current')).toBe('page');
    expect(here.getAttribute('target')).toBeNull();
    expect(within(menu).getAllByRole('separator')).toHaveLength(1);
    expect(within(menu).getByRole('menuitem', { name: 'Theme' })).toBeTruthy();
    expect(within(menu).queryByRole('menuitem', { name: 'Settings' })).toBeNull();
  });

  it('without a project yet: no switcher, and the board link has no project', () => {
    render(<DocsPage noSwitcher />);
    expect(screen.queryByRole('button', { name: /Recipe Box/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Open the board' }).getAttribute('href')).toBe('/');
  });
});

describe('the connection dot', () => {
  it('is in the switcher, with no "Live" text; reconnecting shows a spinner', () => {
    render(<Live />);
    expect(screen.getByTestId('conn').textContent).toBe('');
    expect(screen.queryByText('Live')).toBeNull();
    cleanup();
    render(<Reconnecting />);
    expect(within(screen.getByTestId('conn')).getByTestId('spinner')).toBeTruthy();
  });
});
