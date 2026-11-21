import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { composeStories } from '@storybook/react-vite';
import * as stories from './spec-section.stories';

const { View, Editing } = composeStories(stories);

afterEach(cleanup);

describe('SpecSection', () => {
  it('view mode renders Markdown with an Edit button', () => {
    const onEdit = vi.fn();
    render(<View md={'Hello **world**'} onEdit={onEdit} />);
    expect(screen.getByText('world').tagName).toBe('STRONG');
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalled();
  });

  it('shows an image relative to the spec folder, in view and in the preview', () => {
    const body = '![Login screen](images/login.png)';
    const { unmount } = render(<View md={body} pid="p1" baseDir=".specboard/specs/T-001-x" />);
    const want = '/api/projects/p1/image?path=.specboard%2Fspecs%2FT-001-x%2Fimages%2Flogin.png';
    expect(screen.getByRole('img', { name: 'Login screen' }).getAttribute('src')).toBe(want);
    unmount();
    render(<Editing md="old" text={body} pid="p1" baseDir=".specboard/specs/T-001-x" />);
    expect(screen.getByRole('img', { name: 'Login screen' }).getAttribute('src')).toBe(want);
  });

  it('edit mode shows the textarea and a live preview', () => {
    const h = { onChange: vi.fn(), onCancel: vi.fn(), onSave: vi.fn() };
    render(<Editing md="old" text={'# Title\n\nsome *em*'} {...h} />);
    expect(screen.getByText('Markdown · preview on the right')).toBeTruthy();
    expect(screen.getByText('em').tagName).toBe('EM');
    fireEvent.change(screen.getByRole('textbox', { name: 'Spec markdown' }), { target: { value: 'x' } });
    expect(h.onChange).toHaveBeenCalledWith('x');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(h.onCancel).toHaveBeenCalled();
    expect(h.onSave).toHaveBeenCalled();
  });

  it('Save is off while a save is in flight', () => {
    render(<Editing saving />);
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('puts Cancel and Save under the editor, with the note staying in the header', () => {
    render(<Editing />);
    const box = screen.getByRole('textbox', { name: 'Spec markdown' });
    const follows = (el: HTMLElement) => Boolean(box.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(screen.getByRole('button', { name: 'Cancel' }))).toBe(true);
    expect(follows(screen.getByRole('button', { name: 'Save' }))).toBe(true);
    expect(follows(screen.getByText('Markdown · preview on the right'))).toBe(false);
  });

  describe('images', () => {
    const png = (name = 'a.png') => new File(['x'], name, { type: 'image/png' });
    const box = () => screen.getByRole('textbox', { name: 'Spec markdown' }) as HTMLTextAreaElement;
    const at = (pos: number) => {
      box().focus();
      box().setSelectionRange(pos, pos);
    };
    const paste = (files: File[]) => fireEvent.paste(box(), { clipboardData: { files, items: [], types: ['Files'] } });

    it('pasting an image uploads it and inserts Markdown at the cursor', async () => {
      const onUpload = vi.fn().mockResolvedValue('images/a.png');
      const onChange = vi.fn();
      render(<Editing text="ab" onUpload={onUpload} onChange={onChange} />);
      at(1);
      paste([png()]);
      expect(onUpload).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(onChange).toHaveBeenCalledWith('a![a](images/a.png)b'));
    });

    it('dropping an image does the same', async () => {
      const onUpload = vi.fn().mockResolvedValue('images/a.png');
      const onChange = vi.fn();
      render(<Editing text="ab" onUpload={onUpload} onChange={onChange} />);
      at(2);
      fireEvent.drop(box(), { dataTransfer: { files: [png()], types: ['Files'] } });
      expect(onUpload).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(onChange).toHaveBeenCalledWith('ab![a](images/a.png)'));
    });

    it('Add image exists only in edit mode and uploads the chosen file', async () => {
      const onUpload = vi.fn().mockResolvedValue('images/a.png');
      const onChange = vi.fn();
      const { unmount } = render(<View onUpload={onUpload} />);
      expect(screen.queryByRole('button', { name: 'Add image' })).toBeNull();
      unmount();
      const { container } = render(<Editing text="" onUpload={onUpload} onChange={onChange} />);
      expect(screen.getByRole('button', { name: 'Add image' })).toBeTruthy();
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [png()] } });
      expect(onUpload).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(onChange).toHaveBeenCalledWith('![a](images/a.png)'));
    });

    it('shows Uploading… and disables the button while pending', async () => {
      let done: (p: string) => void = () => undefined;
      const onUpload = vi.fn().mockReturnValue(new Promise<string>((r) => (done = r)));
      render(<Editing text="" onUpload={onUpload} />);
      paste([png()]);
      const btn = (await screen.findByRole('button', { name: 'Uploading…' })) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      done('images/a.png');
      await screen.findByRole('button', { name: 'Add image' });
    });

    it('a rejected upload leaves the text alone and reports the error', async () => {
      const onUpload = vi.fn().mockRejectedValue(new Error('Too big'));
      const onChange = vi.fn();
      const onUploadError = vi.fn();
      render(<Editing text="ab" onUpload={onUpload} onChange={onChange} onUploadError={onUploadError} />);
      paste([png()]);
      await waitFor(() => expect(onUploadError).toHaveBeenCalledWith('Too big'));
      expect(onChange).not.toHaveBeenCalled();
    });

    it('pasting plain text does not upload', () => {
      const onUpload = vi.fn();
      render(<Editing text="ab" onUpload={onUpload} />);
      fireEvent.paste(box(), { clipboardData: { files: [], items: [], types: ['text/plain'], getData: () => 'hi' } });
      expect(onUpload).not.toHaveBeenCalled();
    });
  });
});
