import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
});
