import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

// The prototype's colour swatches (docs/design/Spec Board.dc.html line 818, markup line 404).
const SWATCHES: [string, string][] = [
  ['Background', '--bg'],
  ['Column', '--panel'],
  ['Surface', '--card'],
  ['Line', '--line'],
  ['Text', '--fg'],
  ['Text 2', '--fg2'],
  ['Accent', '--accent'],
  ['Doing', '--doing'],
  ['Review', '--review'],
  ['Done', '--done'],
  ['Blocked', '--block'],
];
const THEMES = [
  { name: 'light', label: 'Light' },
  { name: 'dark', label: 'Dark' },
];

function SwatchSheet() {
  return (
    <div>
      {THEMES.map((th) => (
        <div
          key={th.name}
          data-theme={th.name}
          data-testid={`theme-${th.name}`}
          style={{ background: 'var(--bg)', color: 'var(--fg)', padding: '40px 40px 64px', display: 'flex', flexDirection: 'column', gap: 36, fontFamily: 'var(--sans)' }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em' }}>Spec Board components</span>
            <span style={{ fontSize: 14, color: 'var(--fg3)' }}>{th.label} theme</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.09em', color: 'var(--fg3)' }}>COLOUR</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(104px,1fr))', gap: 10 }}>
              {SWATCHES.map(([name, token]) => (
                <div key={token} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div data-testid={`swatch-${th.name}${token}`} style={{ height: 48, borderRadius: 8, background: `var(${token})`, border: '1px solid var(--line)' }} />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{name}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--fg3)' }}>{token}</span>
                </div>
              ))}
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
    expect(c.getAllByText('--accent')).toHaveLength(2);
    expect(c.getAllByText('Blocked')).toHaveLength(2);
    // The tokens resolve, and differ between the two themes.
    const light = getComputedStyle(c.getByTestId('swatch-light--bg')).backgroundColor;
    const dark = getComputedStyle(c.getByTestId('swatch-dark--bg')).backgroundColor;
    expect(light).not.toBe('');
    expect(light).not.toBe('rgba(0, 0, 0, 0)');
    expect(light).not.toBe(dark);
  },
};
