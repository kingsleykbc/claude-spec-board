import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiError } from '../api/client';
import { recipeSpec } from '../fixtures/recipeBox';
import { OFFLINE_TOAST } from '../state/actions';
import { AddSpecModal } from './AddSpecModal';

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
  render(<AddSpecModal {...props} />);
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
    expect(draftBtn().style.opacity).toBe('0.45');
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '   ' } });
    expect(draftBtn().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Nutrition info' } });
    expect(draftBtn().disabled).toBe(false);
    expect(writeBtn().disabled).toBe(false);
    expect(draftBtn().style.opacity).toBe('1');
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

  it('Add & have Claude write it up creates a draft, then calls the write-up stub', async () => {
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
});
