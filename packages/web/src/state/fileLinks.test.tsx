import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FileLink, FileLinks, fullPath } from './fileLinks';

const writeText = vi.fn(async (_t: string) => undefined);

beforeEach(() => {
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});
afterEach(cleanup);

const setup = (openFile: (pid: string, rel: string) => Promise<{ opened: boolean; path: string; reason?: 'missing' | 'no-editor' }>) => {
  const toast = vi.fn();
  render(
    <FileLinks pid="p1" root="C:\proj" toast={toast} client={{ openFile }}>
      <FileLink path="src/a.ts" />
    </FileLinks>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'src/a.ts' }));
  return toast;
};

describe('FileLink', () => {
  it('opens through the server and copies nothing when that works', async () => {
    const openFile = vi.fn(async () => ({ opened: true, path: 'C:\\proj\\src\\a.ts' }));
    const toast = setup(openFile);
    await waitFor(() => expect(toast).toHaveBeenCalledWith('ok', 'Opened in VS Code', 'src/a.ts'));
    expect(openFile).toHaveBeenCalledWith('p1', 'src/a.ts');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('with no editor, copies the server’s full path and says so', async () => {
    const toast = setup(async () => ({ opened: false, path: 'C:\\proj\\src\\a.ts', reason: 'no-editor' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('info', 'File path copied', 'C:\\proj\\src\\a.ts'));
    expect(writeText).toHaveBeenCalledWith('C:\\proj\\src\\a.ts');
  });

  it('says when the file is gone', async () => {
    const toast = setup(async () => ({ opened: false, path: 'C:\\proj\\src\\a.ts', reason: 'missing' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('warn', 'File not found. Path copied', 'C:\\proj\\src\\a.ts'));
  });

  it('when the server can’t be reached, copies the path it can work out', async () => {
    const toast = setup(() => Promise.reject(new Error('offline')));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('info', 'File path copied', 'C:\\proj\\src\\a.ts'));
    expect(writeText).toHaveBeenCalledWith('C:\\proj\\src\\a.ts');
  });

  it('when the clipboard refuses, shows the path instead of claiming it was copied', async () => {
    writeText.mockRejectedValue(new Error('denied'));
    const toast = setup(async () => ({ opened: false, path: 'C:\\proj\\src\\a.ts', reason: 'no-editor' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('err', 'Couldn’t copy the file path', 'C:\\proj\\src\\a.ts'));
  });

  it('is plain text with no project around it', () => {
    render(<FileLink path="src/a.ts" />);
    expect(screen.getByText('src/a.ts')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('fullPath', () => {
  it('joins with the root’s own separator and leaves a full path alone', () => {
    expect(fullPath('C:\\proj\\', 'src/a.ts')).toBe('C:\\proj\\src\\a.ts');
    expect(fullPath('/home/u/p', 'src/a.ts')).toBe('/home/u/p/src/a.ts');
    expect(fullPath('C:\\proj', 'D:\\other\\a.ts')).toBe('D:\\other\\a.ts');
    expect(fullPath('/home/u/p', '/elsewhere/a.ts')).toBe('/elsewhere/a.ts');
  });
});
