import { afterEach, describe, expect, it } from 'vitest';
import { layerOpen } from './openLayer';

const add = (html: string) => {
  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.append(el);
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('layerOpen', () => {
  it('is false with nothing open', () => {
    expect(layerOpen()).toBe(false);
  });

  it('is true for a Radix menu or popover and for a vaul drawer', () => {
    add('<div data-radix-popper-content-wrapper><div role="menu"></div></div>');
    expect(layerOpen()).toBe(true);
    document.body.innerHTML = '';
    add('<div data-radix-popper-content-wrapper><div role="dialog"></div></div>');
    expect(layerOpen()).toBe(true);
    document.body.innerHTML = '';
    add('<div data-vaul-drawer role="dialog"></div>');
    expect(layerOpen()).toBe(true);
  });

  it('ignores a tooltip, so a focused button’s tooltip does not swallow a scrim click', () => {
    add('<div data-radix-popper-content-wrapper><div data-state="delayed-open"><span role="tooltip">Hint</span></div></div>');
    expect(layerOpen()).toBe(false);
  });
});
