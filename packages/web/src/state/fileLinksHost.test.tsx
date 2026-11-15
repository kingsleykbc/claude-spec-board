import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip/tooltip';
import { Toasts } from '@/components/ui/toasts/toasts';
import { FileLinks, FileLinksHost } from './fileLinks';

afterEach(cleanup);

const PATH = '.specboard/specs/T-1/spec.md';
const toasts = [{ id: 1, kind: 'ok' as const, text: 'Spec saved', path: PATH }];

function tree(withProject: boolean, openFile: () => Promise<{ opened: boolean; path: string }>) {
  return (
    <TooltipProvider>
      <FileLinksHost>
        {withProject ? <FileLinks pid="p1" root="/proj" toast={vi.fn()} client={{ openFile }}>{null}</FileLinks> : null}
        <Toasts toasts={toasts} onDismiss={vi.fn()} />
      </FileLinksHost>
    </TooltipProvider>
  );
}

describe('FileLinksHost', () => {
  it('opens a toast path through the project handler, and is plain text once the project unmounts', async () => {
    const openFile = vi.fn(async () => ({ opened: true, path: `/proj/${PATH}` }));
    const { rerender } = render(tree(true, openFile));
    fireEvent.click(await screen.findByRole('button', { name: PATH }));
    await waitFor(() => expect(openFile).toHaveBeenCalledWith('p1', PATH));

    rerender(tree(false, openFile));
    await waitFor(() => expect(screen.queryByRole('button', { name: PATH })).toBeNull());
    expect(screen.getByText(PATH)).toBeTruthy();
  });
});
