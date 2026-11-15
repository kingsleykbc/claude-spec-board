import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { composeStories } from '@storybook/react-vite';
import * as stories from './inline-markdown.stories';

const { Plain } = composeStories(stories);

afterEach(cleanup);

/** Render in the light column only, so counts are not doubled by the dark one. */
function light(md: string) {
  const { container } = render(<Plain md={md} />);
  return container.querySelector('[data-theme="light"]') as HTMLElement;
}

describe('InlineMarkdown', () => {
  it('renders bold runs as strong with no literal asterisks', () => {
    const el = light('**tags** and **cook time**');
    expect(el.querySelectorAll('strong')).toHaveLength(2);
    expect(el.textContent).not.toContain('**');
    expect(el.textContent).toBe('tags and cook time');
  });

  it('renders em, code and strike-through', () => {
    const el = light('*a* `b` ~~c~~');
    expect(el.querySelector('em')?.textContent).toBe('a');
    expect(el.querySelector('code')?.textContent).toBe('b');
    expect(el.querySelector('del')?.textContent).toBe('c');
  });

  it('shows link text without an anchor', () => {
    const el = light('[docs](http://x)');
    expect(el.textContent).toBe('docs');
    expect(el.querySelector('a')).toBeNull();
  });

  it('drops images', () => {
    const el = light('![a](b.png)');
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toBe('');
  });

  it('adds no paragraph and unwraps blocks; raw HTML stays off', () => {
    const el = light('# Head\n\n<b>x</b> <script>1</script>');
    expect(el.querySelector('p, h1, h2, b, script')).toBeNull();
  });
});
