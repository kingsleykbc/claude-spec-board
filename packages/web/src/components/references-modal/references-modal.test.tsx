import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { composeStories } from '@storybook/react-vite';
import { ApiError, ConflictError, type ReferenceDoc } from '@/api/client';
import { OFFLINE_TOAST } from '@/state/actions';
import { type RefsClient } from './references-modal';
import * as stories from './references-modal.stories';

const { ReadMode } = composeStories(stories);

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const doc = (path: string, md: string, missing = false): ReferenceDoc => ({
  name: path.split('/').pop()!,
  path,
  md: missing ? '' : md,
  hash: missing ? '' : `h:${path}`,
  missing,
});

const DOCS = [doc('CLAUDE.md', '# Claude\n\nHouse rules.'), doc('docs/CONTEXT.md', '# Context\n\nWhy we build.'), doc('docs/GONE.md', '', true)];

function setup(over: Partial<RefsClient> = {}, props: { down?: boolean } = {}) {
  let list = [...DOCS];
  const client: RefsClient = {
    references: vi.fn(async () => list),
    saveReference: vi.fn(async () => ({ hash: 'h2' })),
    linkReference: vi.fn(async (_pid: string, path: string) => {
      list = [...list, doc(path, `# ${path}`)];
      return { path };
    }),
    createReference: vi.fn(async (_pid: string, name: string) => {
      const path = `docs/${name.toUpperCase()}.md`;
      list = [...list, doc(path, `# ${name.toUpperCase()}\n\n`)];
      return { path };
    }),
    removeReference: vi.fn(async (_pid: string, path: string) => {
      list = list.filter((d) => d.path !== path);
    }),
    referenceDraftCopy: vi.fn(async () => ({ path: 'CLAUDE.draft.md' })),
    files: vi.fn(async () => ['CLAUDE.md', 'docs/ARCHITECTURE.md', 'README.md']),
    ...over,
  };
  const toast = vi.fn();
  const onClose = vi.fn();
  render(<ReadMode pid="p1" client={client} toast={toast} onClose={onClose} down={props.down ?? false} />);
  return { client, toast, onClose };
}

const tabs = () => screen.getAllByRole('tab').map((t) => t.textContent);

describe('ReferencesModal', () => {
  it('shows tabs in config order with the first active, its path and rendered body', async () => {
    setup();
    await screen.findByText('House rules.');
    expect(tabs()).toEqual(['CLAUDE.md', 'CONTEXT.md', 'GONE.md']);
    expect(screen.getByRole('tab', { name: 'CLAUDE.md' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('ref-path').textContent).toBe('CLAUDE.md');
  });

  it('a missing file shows its tab with "File not found"', async () => {
    setup();
    await screen.findByText('House rules.');
    fireEvent.click(screen.getByRole('tab', { name: 'GONE.md' }));
    expect(screen.getByText('File not found')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  it('edits and saves with the hash from when editing began', async () => {
    const { client, toast } = setup();
    await screen.findByText('House rules.');
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByText((_, el) => el?.textContent === 'Editing CLAUDE.md')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Document markdown' }), { target: { value: '# Claude\n\nNew **rules**.' } });
    expect(screen.getByText('rules').tagName).toBe('STRONG');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('ok', 'Saved CLAUDE.md', 'CLAUDE.md'));
    expect(client.saveReference).toHaveBeenCalledWith('p1', 'CLAUDE.md', 'h:CLAUDE.md', '# Claude\n\nNew **rules**.');
    expect(screen.queryByRole('textbox', { name: 'Document markdown' })).toBeNull();
  });

  it('a 409 opens the conflict dialog; keep my copy goes through references/draft-copy', async () => {
    const { client, toast } = setup({ saveReference: vi.fn(async () => Promise.reject(new ConflictError('h9', 'theirs'))) });
    await screen.findByText('House rules.');
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Document markdown' }), { target: { value: 'mine' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const dlg = await screen.findByRole('alertdialog', { name: 'This document changed outside the board' });
    expect(within(dlg).getByText('CLAUDE.md')).toBeTruthy();
    fireEvent.click(within(dlg).getByRole('button', { name: 'Reload & keep my copy' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('ok', 'Reloaded latest version', 'Your text is saved as CLAUDE.draft.md'));
    expect(client.referenceDraftCopy).toHaveBeenCalledWith('p1', 'CLAUDE.md', 'mine');
    expect(screen.queryByRole('textbox', { name: 'Document markdown' })).toBeNull();
  });

  it('Keep editing after a 409 keeps the text and the original base hash', async () => {
    const save = vi.fn(async () => Promise.reject(new ConflictError('h9', 'theirs')));
    setup({ saveReference: save });
    await screen.findByText('House rules.');
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Document markdown' }), { target: { value: 'mine' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Keep editing' }));
    expect((screen.getByRole('textbox', { name: 'Document markdown' }) as HTMLTextAreaElement).value).toBe('mine');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save).toHaveBeenLastCalledWith('p1', 'CLAUDE.md', 'h:CLAUDE.md', 'mine');
  });

  it('a 404 "Not a linked reference" shows an err toast', async () => {
    const { toast } = setup({ saveReference: vi.fn(async () => Promise.reject(new ApiError(404, 'Not a linked reference'))) });
    await screen.findByText('House rules.');
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('err', 'Couldn’t save CLAUDE.md', 'Not a linked reference'));
  });

  it('Esc with unsaved edits asks "Discard your changes?" before leaving the editor; then Esc closes', async () => {
    const { onClose } = setup();
    await screen.findByText('House rules.');
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Document markdown' }), { target: { value: 'changed' } });
    fireEvent.keyDown(document, { key: 'Escape' });
    const dlg = screen.getByRole('alertdialog', { name: 'Discard your changes?' });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Discard' }));
    expect(screen.queryByRole('textbox', { name: 'Document markdown' })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('switching tabs with unsaved edits asks first, then switches on Discard', async () => {
    setup();
    await screen.findByText('House rules.');
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Document markdown' }), { target: { value: 'changed' } });
    fireEvent.click(screen.getByRole('tab', { name: 'CONTEXT.md' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.getByRole('tab', { name: 'CONTEXT.md' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Why we build.')).toBeTruthy();
  });

  it('creating "deploy" posts {name:"deploy"} and opens DEPLOY.md in edit mode', async () => {
    const { client } = setup();
    await screen.findByText('House rules.');
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(screen.getByRole('button', { name: /Create a new document/ }));
    const input = screen.getByRole('textbox', { name: 'Document name' });
    fireEvent.change(input, { target: { value: 'deploy' } });
    expect(screen.getByText('Saved as docs/DEPLOY.md')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await screen.findByText((_, el) => el?.textContent === 'Editing docs/DEPLOY.md');
    expect(client.createReference).toHaveBeenCalledWith('p1', 'deploy');
    expect(screen.getByRole('tab', { name: 'DEPLOY.md' }).getAttribute('aria-selected')).toBe('true');
    expect((screen.getByRole('textbox', { name: 'Document markdown' }) as HTMLTextAreaElement).value).toBe('# DEPLOY\n\n');
  });

  it('create "Already exists" shows an err toast and keeps the menu open', async () => {
    const { toast } = setup({ createReference: vi.fn(async () => Promise.reject(new ApiError(409, 'Already exists'))) });
    await screen.findByText('House rules.');
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(screen.getByRole('button', { name: /Create a new document/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Document name' }), { target: { value: 'claude' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('err', 'Couldn’t create docs/CLAUDE.md', 'Already exists'));
    expect(screen.getByRole('textbox', { name: 'Document name' })).toBeTruthy();
  });

  it('link suggestions come from files?q= (debounced) minus linked paths; picking links it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { client, toast } = setup();
    await screen.findByText('House rules.');
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(screen.getByRole('button', { name: /Link an existing file/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'File path' }), { target: { value: 'R' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'File path' }), { target: { value: 'RE' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(160);
    });
    expect(client.files).toHaveBeenCalledTimes(1);
    expect(client.files).toHaveBeenCalledWith('p1', 'RE');
    await screen.findByRole('button', { name: 'README.md' });
    expect(screen.getByRole('button', { name: 'docs/ARCHITECTURE.md' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'CLAUDE.md' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'README.md' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('ok', 'Linked README.md', 'README.md'));
    expect(client.linkReference).toHaveBeenCalledWith('p1', 'README.md');
    expect(screen.getByRole('tab', { name: 'README.md' }).getAttribute('aria-selected')).toBe('true');
  });

  it('Esc closes the add menu before the modal', async () => {
    const { onClose } = setup();
    await screen.findByText('House rules.');
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('button', { name: /Link an existing file/ })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('button', { name: /Link an existing file/ })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Remove from list asks for confirmation, then sends DELETE', async () => {
    const { client, toast } = setup();
    await screen.findByText('House rules.');
    fireEvent.click(screen.getByRole('button', { name: 'Remove from list' }));
    const dlg = screen.getByRole('alertdialog', { name: 'Remove CLAUDE.md from references?' });
    expect(within(dlg).getByText('This removes the link only. The file stays in your project and you can link it again later.')).toBeTruthy();
    expect(client.removeReference).not.toHaveBeenCalled();
    fireEvent.click(within(dlg).getByRole('button', { name: 'Remove link' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('ok', 'Removed CLAUDE.md from references', 'The file was not deleted.'));
    expect(client.removeReference).toHaveBeenCalledWith('p1', 'CLAUDE.md');
    expect(tabs()).toEqual(['CONTEXT.md', 'GONE.md']);
    expect(screen.getByRole('tab', { name: 'CONTEXT.md' }).getAttribute('aria-selected')).toBe('true');
  });

  it('while disconnected, mutations show the offline toast and send nothing', async () => {
    const { client, toast } = setup({}, { down: true });
    await screen.findByText('House rules.');
    fireEvent.click(screen.getByRole('button', { name: 'Remove from list' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove link' }));
    expect(client.removeReference).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('err', ...OFFLINE_TOAST);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(client.saveReference).not.toHaveBeenCalled();
  });

  it('create twice in one tick posts once', async () => {
    const { client } = setup();
    await screen.findByText('House rules.');
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(screen.getByRole('button', { name: /Create a new document/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Document name' }), { target: { value: 'deploy' } });
    const btn = screen.getByRole('button', { name: 'Create' });
    // Both clicks land before React re-renders (no disabled state yet).
    act(() => {
      btn.click();
      btn.click();
    });
    await screen.findByText((_, el) => el?.textContent === 'Editing docs/DEPLOY.md');
    expect(client.createReference).toHaveBeenCalledTimes(1);
  });

  it('link twice in one tick posts once', async () => {
    const { client } = setup();
    await screen.findByText('House rules.');
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(screen.getByRole('button', { name: /Link an existing file/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'File path' }), { target: { value: 'README.md' } });
    const btn = screen.getByRole('button', { name: 'Link file' });
    // Both clicks land before React re-renders (no disabled state yet).
    act(() => {
      btn.click();
      btn.click();
    });
    await screen.findByRole('tab', { name: 'README.md' });
    expect(client.linkReference).toHaveBeenCalledTimes(1);
  });

  it('an invalid document name disables Create and shows the rule', async () => {
    setup();
    await screen.findByText('House rules.');
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(screen.getByRole('button', { name: /Create a new document/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Document name' }), { target: { value: '../evil' } });
    expect(screen.getByRole('button', { name: 'Create' })).toHaveProperty('disabled', true);
    expect(screen.getByText('Use letters, numbers, dots, dashes or underscores')).toBeTruthy();
    expect(screen.queryByText(/Saved as/)).toBeNull();
    fireEvent.change(screen.getByRole('textbox', { name: 'Document name' }), { target: { value: 'deploy-notes.md' } });
    expect(screen.getByRole('button', { name: 'Create' })).toHaveProperty('disabled', false);
    expect(screen.getByText('Saved as docs/DEPLOY-NOTES.md')).toBeTruthy();
  });

  it('a server 400 on create shows its message as a toast', async () => {
    const { toast } = setup({ createReference: vi.fn(async () => Promise.reject(new ApiError(400, 'Invalid name'))) });
    await screen.findByText('House rules.');
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(screen.getByRole('button', { name: /Create a new document/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Document name' }), { target: { value: 'ok' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('err', 'Couldn’t create docs/OK.md', 'Invalid name'));
  });

  it('after Remove, a failed refetch still drops the removed doc and picks the next tab', async () => {
    const references = vi.fn(async () => [...DOCS]);
    setup({ references });
    await screen.findByText('House rules.');
    references.mockRejectedValue(new Error('offline'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove from list' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove link' }));
    await waitFor(() => expect(tabs()).toEqual(['CONTEXT.md', 'GONE.md']));
    expect(screen.getByRole('tab', { name: 'CONTEXT.md' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByText('House rules.')).toBeNull();
  });
});
