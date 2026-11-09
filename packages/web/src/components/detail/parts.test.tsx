import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { BlockedBanner } from './BlockedBanner';
import { CategoryEditor, categorySuggestions } from './CategoryEditor';
import { FileProblem } from './FileProblem';
import { SpecSection } from './SpecSection';
import { StatusMenu } from './StatusMenu';
import { UrgencyControl } from './UrgencyControl';

afterEach(cleanup);

describe('StatusMenu', () => {
  it('toggles, notes Current and Approve, and closes on pick or on the scrim', () => {
    const onPick = vi.fn();
    render(<StatusMenu status="todo" onPick={onPick} />);
    const btn = screen.getByRole('button', { name: /To-do/ });
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(btn);
    expect(within(screen.getByRole('menu')).getByRole('menuitemradio', { name: /To-do/ }).textContent).toContain('Current');
    expect(screen.getByRole('menuitemradio', { name: /Done/ }).textContent).toContain('Approve');
    fireEvent.click(screen.getByTestId('status-menu-scrim'));
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(btn);
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Doing/ }));
    expect(onPick).toHaveBeenCalledWith('doing');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('picking the current status sends nothing', () => {
    const onPick = vi.fn();
    render(<StatusMenu status="todo" onPick={onPick} />);
    fireEvent.click(screen.getByRole('button', { name: /To-do/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /To-do/ }));
    expect(onPick).not.toHaveBeenCalled();
  });
});

describe('UrgencyControl', () => {
  it('lists Low to Urgent with the current one checked, and reports a different pick', () => {
    const onPick = vi.fn();
    render(<UrgencyControl value="normal" onPick={onPick} />);
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.textContent)).toEqual(['Low', 'Normal', 'High', 'Urgent']);
    expect(radios[1]!.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(radios[1]!);
    expect(onPick).not.toHaveBeenCalled();
    fireEvent.click(radios[0]!);
    expect(onPick).toHaveBeenCalledWith('low');
  });
});

describe('CategoryEditor', () => {
  it('categorySuggestions filters by substring, skips the spec’s own, and offers Create for new text', () => {
    const all = ['Frontend', 'Backend', 'Auth', 'Infra'];
    expect(categorySuggestions(all, ['Frontend'], '')).toEqual([
      { name: 'Backend', label: 'Backend' },
      { name: 'Auth', label: 'Auth' },
      { name: 'Infra', label: 'Infra' },
    ]);
    expect(categorySuggestions(all, ['Frontend'], 'END')).toEqual([
      { name: 'Backend', label: 'Backend' },
      { name: 'END', label: 'Create “END”' },
    ]);
    expect(categorySuggestions(all, [], ' Payments ')).toEqual([{ name: 'Payments', label: 'Create “Payments”' }]);
    expect(categorySuggestions(all, ['Frontend'], 'frontend')).toEqual([]);
  });

  it('shows "Type a new category name" when nothing matches, and closes on blur', () => {
    const onAdd = vi.fn();
    render(<CategoryEditor categories={['Frontend']} all={['Frontend']} onAdd={onAdd} onRemove={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Category' }));
    expect(screen.getByText('Type a new category name')).toBeTruthy();
    fireEvent.blur(screen.getByPlaceholderText('Category…'));
    expect(screen.queryByPlaceholderText('Category…')).toBeNull();
  });

  it('Enter uses an existing category’s spelling', () => {
    const onAdd = vi.fn();
    render(<CategoryEditor categories={[]} all={['Infra']} onAdd={onAdd} onRemove={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Category' }));
    const input = screen.getByPlaceholderText('Category…');
    fireEvent.change(input, { target: { value: 'infra' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onAdd).toHaveBeenCalledWith('Infra');
  });
});

describe('SpecSection', () => {
  it('view mode renders Markdown with an Edit button', () => {
    const onEdit = vi.fn();
    render(<SpecSection md={'Hello **world**'} text={null} onEdit={onEdit} onChange={() => undefined} onCancel={() => undefined} onSave={() => undefined} />);
    expect(screen.getByText('world').tagName).toBe('STRONG');
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalled();
  });

  it('edit mode shows the textarea and a live preview', () => {
    const h = { onChange: vi.fn(), onCancel: vi.fn(), onSave: vi.fn() };
    render(<SpecSection md="old" text={'# Title\n\nsome *em*'} onEdit={() => undefined} {...h} />);
    expect(screen.getByText('Markdown · preview on the right')).toBeTruthy();
    expect(screen.getByText('em').tagName).toBe('EM');
    fireEvent.change(screen.getByRole('textbox', { name: 'Spec markdown' }), { target: { value: 'x' } });
    expect(h.onChange).toHaveBeenCalledWith('x');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(h.onCancel).toHaveBeenCalled();
    expect(h.onSave).toHaveBeenCalled();
  });
});

describe('BlockedBanner', () => {
  it('renders each reason as a button', () => {
    const a = vi.fn();
    render(<BlockedBanner reasons={[{ key: 'q', text: 'Awaiting answers on: X', onClick: a }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Awaiting answers on: X' }));
    expect(a).toHaveBeenCalled();
    expect(within(screen.getByRole('status')).getByText('!')).toBeTruthy();
  });
});

describe('FileProblem', () => {
  it('shows the message and path and the fix button', () => {
    const onFix = vi.fn();
    render(<FileProblem message="Bad line" path="specs/a.md" onFix={onFix} />);
    expect(screen.getByText('Bad line')).toBeTruthy();
    expect(screen.getByText('specs/a.md')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ask Claude to fix' }));
    expect(onFix).toHaveBeenCalled();
  });
});
