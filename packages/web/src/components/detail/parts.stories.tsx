import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { BlockedBanner } from './BlockedBanner';
import { CategoryEditor } from './CategoryEditor';
import { DetailHeader } from './DetailHeader';
import { FileProblem } from './FileProblem';
import { SpecSection } from './SpecSection';
import { StatusMenu } from './StatusMenu';
import { UrgencyControl } from './UrgencyControl';
import { recipeSpec } from '../../fixtures/recipeBox';

// The card detail's parts on their own (the full modal is in Detail/CardDetail).

const meta = {
  title: 'Detail/Parts',
  decorators: [
    (Story) => (
      <div style={{ padding: 24, maxWidth: 900, background: 'var(--card)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Header: Story = {
  render: () => (
    <DetailHeader
      id="T-103"
      path=".specboard/specs/T-103-search-and-filters/spec.md"
      title="Search & filters"
      status="review"
      urgency="high"
      categories={['Frontend', 'Backend']}
      allCategories={['Frontend', 'Backend', 'Auth', 'Infra']}
      runState="ready"
      onRun={fn()}
      onStop={fn()}
      onStatus={fn()}
      onUrgency={fn()}
      onAddCategory={fn()}
      onRemoveCategory={fn()}
      onClose={fn()}
    />
  ),
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getByRole('heading', { level: 1, name: 'Search & filters' })).toBeTruthy();
  },
};

export const StatusMenuOpen: Story = {
  render: () => (
    <div style={{ display: 'flex', justifyContent: 'flex-end', height: 220 }}>
      <StatusMenu status="review" onPick={fn()} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('button', { name: /Review/ }));
    expect(c.getByRole('menuitemradio', { name: /Done/ }).textContent).toContain('Approve');
    expect(c.getByRole('menuitemradio', { name: /Review/ }).textContent).toContain('Current');
  },
};

export const Urgency: Story = {
  render: () => <UrgencyControl value="urgent" onPick={fn()} />,
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getByRole('radio', { name: /Urgent/ }).getAttribute('aria-checked')).toBe('true');
  },
};

export const CategoryAdding: Story = {
  render: () => (
    <div style={{ height: 200 }}>
      <CategoryEditor categories={['Frontend']} all={['Frontend', 'Backend', 'Auth', 'Infra']} onAdd={fn()} onRemove={fn()} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('button', { name: 'Category' }));
    await userEvent.type(c.getByPlaceholderText('Category…'), 'Pay');
    expect(c.getByRole('option', { name: 'Create “Pay”' })).toBeTruthy();
  },
};

export const SpecView: Story = {
  render: () => <SpecSection md={recipeSpec('T-105').bodyMd} text={null} onEdit={fn()} onChange={fn()} onCancel={fn()} onSave={fn()} />,
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getByText('SPEC')).toBeTruthy();
  },
};

export const SpecEditing: Story = {
  render: () => {
    const md = recipeSpec('T-105').bodyMd;
    return <SpecSection md={md} text={md} onEdit={fn()} onChange={fn()} onCancel={fn()} onSave={fn()} />;
  },
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getByRole('textbox', { name: 'Spec markdown' })).toBeTruthy();
  },
};

export const Banner: Story = {
  render: () => (
    <BlockedBanner
      reasons={[
        { key: 'q', text: 'Awaiting answers on: Should the export include quantities?, Preferred export format?', onClick: fn() },
        { key: 'd', text: 'Waiting on T-104 Meal planner calendar (Doing)', onClick: fn() },
      ]}
    />
  ),
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getAllByRole('button')).toHaveLength(2);
  },
};

export const FileProblemPanel: Story = {
  render: () => (
    <FileProblem
      message="The subtask on line 18 is missing its checkbox…"
      path=".specboard/specs/T-109-import-recipes-from-a-file/spec.md"
      onFix={fn()}
    />
  ),
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getByRole('button', { name: 'Ask Claude to fix' })).toBeTruthy();
  },
};
