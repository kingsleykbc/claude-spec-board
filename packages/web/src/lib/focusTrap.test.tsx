import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from './focusTrap';

afterEach(cleanup);

/** A trapped box with two buttons, plus a portalled layer (as a Radix menu or popover is) rendered from inside it. */
function Trapped() {
  const ref = useRef<HTMLDivElement | null>(null);
  const onKeyDown = useFocusTrap(ref);
  return (
    <div ref={ref} tabIndex={-1} onKeyDown={onKeyDown}>
      <button type="button">First</button>
      <button type="button">Last</button>
      {createPortal(
        <div>
          <button type="button">In portal</button>
          <button type="button">Portal last</button>
        </div>,
        document.body,
      )}
    </div>
  );
}

describe('useFocusTrap', () => {
  it('wraps Tab inside the box', () => {
    render(<Trapped />);
    screen.getByText('Last').focus();
    fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByText('First'));
    fireEvent.keyDown(document.activeElement!, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByText('Last'));
  });

  it('leaves Tab alone when it bubbles up (through React) from a portalled layer', () => {
    render(<Trapped />);
    const inPortal = screen.getByText('In portal');
    inPortal.focus();
    // Not handled: no preventDefault, focus stays put for the layer (or the browser) to move.
    expect(fireEvent.keyDown(inPortal, { key: 'Tab' })).toBe(true);
    expect(document.activeElement).toBe(inPortal);
    expect(fireEvent.keyDown(inPortal, { key: 'Tab', shiftKey: true })).toBe(true);
    expect(document.activeElement).toBe(inPortal);
  });
});
