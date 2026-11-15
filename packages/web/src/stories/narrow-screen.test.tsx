import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { useNarrow } from '@/lib/useNarrow';
import { NarrowScreen } from './narrow-screen';

afterEach(cleanup);

function Probe() {
  return <span data-testid="probe">{useNarrow() ? 'narrow' : 'wide'}</span>;
}

describe('NarrowScreen', () => {
  it('children see a narrow window from their first render, and the real matchMedia is back after unmount', () => {
    const real = window.matchMedia;
    const seen: string[] = [];
    function Spy() {
      seen.push(window.matchMedia('(max-width: 720px)').matches ? 'narrow' : 'wide');
      return <Probe />;
    }
    const r = render(
      <NarrowScreen>
        <Spy />
      </NarrowScreen>,
    );
    expect(r.getByTestId('probe').textContent).toBe('narrow');
    expect(seen.every((s) => s === 'narrow')).toBe(true);
    expect(window.matchMedia).not.toBe(real);
    r.unmount();
    expect(window.matchMedia).toBe(real);
  });
});
