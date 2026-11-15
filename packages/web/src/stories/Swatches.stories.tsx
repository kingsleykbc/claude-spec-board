import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

// The token utilities from styles/app.css (`@theme inline`), one swatch each, in both themes.
// Class names are written out in full so Tailwind generates them.
const BACKGROUNDS: [string, string][] = [
  ['bg-bg', 'Background'],
  ['bg-panel', 'Column'],
  ['bg-card', 'Surface'],
  ['bg-raise', 'Raised'],
  ['bg-line', 'Line'],
  ['bg-line2', 'Line 2'],
  ['bg-fg', 'Text'],
  ['bg-fg2', 'Text 2'],
  ['bg-fg3', 'Text 3'],
  ['bg-code', 'Code'],
  ['bg-scrim', 'Scrim'],
  ['bg-accent', 'Accent'],
  ['bg-accent-hover', 'Accent hover'],
  ['bg-accent-soft', 'Accent soft'],
  ['bg-doing', 'Doing'],
  ['bg-doing-soft', 'Doing soft'],
  ['bg-review', 'Review'],
  ['bg-review-soft', 'Review soft'],
  ['bg-done', 'Done'],
  ['bg-done-soft', 'Done soft'],
  ['bg-block', 'Blocked'],
  ['bg-block-soft', 'Blocked soft'],
];
const TEXTS: [string, string][] = [
  ['text-fg', 'Text'],
  ['text-fg2', 'Text 2'],
  ['text-fg3', 'Text 3'],
  ['text-accent', 'Accent'],
  ['text-accent-ink', 'Accent ink'],
  ['text-doing-ink', 'Doing ink'],
  ['text-review-ink', 'Review ink'],
  ['text-done-ink', 'Done ink'],
  ['text-block-ink', 'Blocked ink'],
];
const THEMES = [
  { name: 'light', label: 'Light' },
  { name: 'dark', label: 'Dark' },
];

const heading = 'text-[11.5px] font-semibold tracking-[0.09em] text-fg3';
const grid = 'grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2.5';
const code = 'font-mono text-[10.5px] text-fg3';

function SwatchSheet() {
  return (
    <div>
      {THEMES.map((th) => (
        <div key={th.name} data-theme={th.name} data-testid={`theme-${th.name}`} className="flex flex-col gap-9 bg-bg px-10 pt-10 pb-16 font-sans text-fg">
          <div className="flex items-baseline gap-3">
            <span className="text-[26px] font-semibold tracking-[-0.02em]">Spec Board tokens</span>
            <span className="text-sm text-fg3">{th.label} theme</span>
          </div>
          <div className="flex flex-col gap-3">
            <span className={heading}>BACKGROUND</span>
            <div className={grid}>
              {BACKGROUNDS.map(([cls, name]) => (
                <div key={cls} className="flex flex-col gap-1.5">
                  <div data-testid={`swatch-${th.name}-${cls}`} className={`h-12 rounded-lg border border-line ${cls}`} />
                  <span className="text-xs font-semibold">{name}</span>
                  <span className={code}>{cls}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <span className={heading}>TEXT</span>
            <div className={grid}>
              {TEXTS.map(([cls, name]) => (
                <div key={cls} className="flex flex-col gap-1.5">
                  <span data-testid={`swatch-${th.name}-${cls}`} className={`text-[22px] font-semibold ${cls}`}>
                    Aa
                  </span>
                  <span className="text-xs font-semibold">{name}</span>
                  <span className={code}>{cls}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <span className={heading}>TYPE AND SHADOW</span>
            <div className="flex flex-wrap items-center gap-6">
              <span className="font-sans text-[15px]">font-sans</span>
              <span className="font-mono text-[13px]">font-mono</span>
              <span className="rounded-lg border border-line bg-card px-4 py-3 text-xs shadow-lg">shadow-lg</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const meta = {
  title: 'Tokens/Swatches',
  component: SwatchSheet,
} satisfies Meta<typeof SwatchSheet>;
export default meta;

export const Swatches: StoryObj<typeof meta> = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getAllByText('bg-accent')).toHaveLength(2);
    expect(c.getAllByText('text-fg2')).toHaveLength(2);
    // The utilities resolve to the tokens, and differ between the two themes.
    const light = getComputedStyle(c.getByTestId('swatch-light-bg-bg')).backgroundColor;
    const dark = getComputedStyle(c.getByTestId('swatch-dark-bg-bg')).backgroundColor;
    expect(light).not.toBe('');
    expect(light).not.toBe('rgba(0, 0, 0, 0)');
    expect(light).not.toBe(dark);
    const fg2 = (t: string) => getComputedStyle(c.getByTestId(`swatch-${t}-text-fg2`)).color;
    expect(fg2('light')).not.toBe(fg2('dark'));
  },
};
