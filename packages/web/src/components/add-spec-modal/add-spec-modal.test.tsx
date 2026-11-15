import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { composeStories } from '@storybook/react-vite';
import { ApiError } from '@/api/client';
import { recipeSpec } from '@/fixtures/recipeBox';
import { OFFLINE_TOAST } from '@/state/actions';
import * as stories from './add-spec-modal.stories';

const { Empty } = composeStories(stories);

afterEach(cleanup);

function setup(over: { down?: boolean; createSpec?: ReturnType<typeof vi.fn>; refresh?: ReturnType<typeof vi.fn> } = {}) {
  const created = { ...recipeSpec('T-107'), id: 'T-109', title: 'Nutrition info' };
  const props = {
    pid: 'p1',
    nextId: 'T-109',
    client: { createSpec: over.createSpec ?? vi.fn(async () => ({ spec: created })) },
    toast: vi.fn(),
    refresh: over.refresh ?? vi.fn(async () => undefined),
    onWriteUp: vi.fn(async () => undefined),
    onClose: vi.fn(),
    down: over.down ?? false,
  };
  render(<Empty {...props} />);
  return { ...props, created };
}

const draftBtn = () => screen.getByRole('button', { name: 'Add as draft' }) as HTMLButtonElement;
const writeBtn = () => screen.getByRole('button', { name: /Add & have Claude write it up/ }) as HTMLButtonElement;

describe('AddSpecModal', () => {
  it('shows the next ID; both buttons are disabled at 45% until a title is entered', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'New spec' })).toBeTruthy();
    expect(screen.getByText('T-109')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText('Title'));
    expect(draftBtn().disabled).toBe(true);
    expect(writeBtn().disabled).toBe(true);
    expect(draftBtn().classList.contains('opacity-45')).toBe(true);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '   ' } });
    expect(draftBtn().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Nutrition info' } });
    expect(draftBtn().disabled).toBe(false);
    expect(writeBtn().disabled).toBe(false);
    expect(draftBtn().classList.contains('opacity-45')).toBe(false);
  });

  it('Add as draft sends draft:true and "No description yet." for an empty description', async () => {
    const p = setup();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '  Nutrition info ' } });
    fireEvent.click(draftBtn());
    await waitFor(() => expect(p.onClose).toHaveBeenCalled());
    expect(p.client.createSpec).toHaveBeenCalledWith('p1', { title: 'Nutrition info', description: 'No description yet.', draft: true });
    expect(p.refresh).toHaveBeenCalled();
    expect(p.toast).toHaveBeenCalledWith('ok', 'T-109 added as draft', 'Nutrition info');
    expect(p.onWriteUp).not.toHaveBeenCalled();
  });

  it('Add & have Claude write it up creates a draft, then calls the write-up', async () => {
    const p = setup();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Nutrition info' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Per serving.' } });
    fireEvent.click(writeBtn());
    await waitFor(() => expect(p.onWriteUp).toHaveBeenCalledWith(p.created));
    expect(p.client.createSpec).toHaveBeenCalledWith('p1', { title: 'Nutrition info', description: 'Per serving.', draft: true });
    expect(p.onClose).toHaveBeenCalled();
  });

  it('a failed create keeps the modal open with an err toast', async () => {
    const p = setup({ createSpec: vi.fn(async () => Promise.reject(new ApiError(500, 'Disk full'))) });
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'X' } });
    fireEvent.click(draftBtn());
    await waitFor(() => expect(p.toast).toHaveBeenCalledWith('err', 'Couldn’t add the spec', 'Disk full'));
    expect(p.onClose).not.toHaveBeenCalled();
  });

  it('while disconnected shows the offline toast and sends nothing', () => {
    const p = setup({ down: true });
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'X' } });
    fireEvent.click(writeBtn());
    expect(p.client.createSpec).not.toHaveBeenCalled();
    expect(p.toast).toHaveBeenCalledWith('err', ...OFFLINE_TOAST);
  });

  it('clicking Add as draft twice in one tick creates once', async () => {
    const p = setup();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'X' } });
    const btn = draftBtn();
    // Both clicks land before React re-renders (no disabled state yet).
    act(() => {
      btn.click();
      btn.click();
    });
    await waitFor(() => expect(p.onClose).toHaveBeenCalled());
    expect(p.client.createSpec).toHaveBeenCalledTimes(1);
  });

  it('a failing refresh still confirms the draft', async () => {
    const p = setup({ refresh: vi.fn(async () => Promise.reject(new Error('offline'))) });
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Nutrition info' } });
    fireEvent.click(draftBtn());
    await waitFor(() => expect(p.toast).toHaveBeenCalledWith('ok', 'T-109 added as draft', 'Nutrition info'));
  });

  it('a failing refresh still calls the write-up', async () => {
    const p = setup({ refresh: vi.fn(async () => Promise.reject(new Error('offline'))) });
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Nutrition info' } });
    fireEvent.click(writeBtn());
    await waitFor(() => expect(p.onWriteUp).toHaveBeenCalledWith(p.created));
  });

  describe('F3d: a typed title or description is not dropped silently', () => {
    const ask = () => screen.getByRole('alertdialog', { name: 'Discard your changes?' });
    const keep = () => fireEvent.click(within(ask()).getByRole('button', { name: 'Keep editing' }));

    it('Esc, scrim and × ask first; Keep editing keeps the text; Discard closes', () => {
      const p = setup();
      fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'An idea' } });
      fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
      keep();
      const scrim = screen.getByRole('dialog', { name: 'New spec' }).parentElement!;
      fireEvent.mouseDown(scrim);
      fireEvent.click(scrim);
      keep();
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      keep();
      expect(p.onClose).not.toHaveBeenCalled();
      expect((screen.getByLabelText('Description') as HTMLTextAreaElement).value).toBe('An idea');
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      fireEvent.click(within(ask()).getByRole('button', { name: 'Discard' }));
      expect(p.onClose).toHaveBeenCalledTimes(1);
    });

    it('with empty fields Esc and × close at once', () => {
      const p = setup();
      fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(p.onClose).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(p.onClose).toHaveBeenCalledTimes(2);
    });

    it('a successful add closes without asking', async () => {
      const p = setup();
      fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Nutrition info' } });
      fireEvent.click(draftBtn());
      await waitFor(() => expect(p.onClose).toHaveBeenCalledTimes(1));
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('(e) beforeunload is registered while a field has text and removed when it is cleared', () => {
      const add = vi.spyOn(window, 'addEventListener');
      const remove = vi.spyOn(window, 'removeEventListener');
      setup();
      const of = (spy: typeof add) => spy.mock.calls.filter(([t]) => t === 'beforeunload');
      expect(of(add)).toHaveLength(0);
      fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'x' } });
      expect(of(add)).toHaveLength(1);
      fireEvent.change(screen.getByLabelText('Title'), { target: { value: '' } });
      expect(of(remove)).toHaveLength(1);
      expect(of(remove)[0]![1]).toBe(of(add)[0]![1]);
      add.mockRestore();
      remove.mockRestore();
    });
  });
});
