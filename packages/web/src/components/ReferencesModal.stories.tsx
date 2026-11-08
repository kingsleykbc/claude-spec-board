import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { ReferenceDoc } from '../api/client';
import { ReferencesModal, type RefsClient } from './ReferencesModal';

const doc = (path: string, md: string): ReferenceDoc => ({ name: path.split('/').pop()!, path, md, hash: `h:${path}`, missing: false });

const DOCS: ReferenceDoc[] = [
  doc(
    'CLAUDE.md',
    '# Recipe Box\n\nHow Claude works in this repo.\n\n## Commands\n\n- `npm run dev` starts the app\n- `npm test` runs the tests\n\n## Rules\n\n- Keep components small\n- Write a test first',
  ),
  doc('docs/CONTEXT.md', '# Context\n\nRecipe Box is a small web app for home cooks.'),
  doc('docs/RULES.md', '# Rules\n\n1. No new dependencies without asking.'),
  { name: 'API-NOTES.md', path: 'docs/API-NOTES.md', md: '', hash: '', missing: true },
];

/** A fake server: the list changes as links and documents are added. */
function client(start: ReferenceDoc[] = DOCS): RefsClient {
  let list = [...start];
  return {
    references: fn(async () => list),
    saveReference: fn(async (_pid: string, path: string, _h: string, md: string) => {
      list = list.map((d) => (d.path === path ? { ...d, md } : d));
      return { hash: 'h2' };
    }),
    linkReference: fn(async (_pid: string, path: string) => {
      list = [...list, doc(path, `# ${path}\n\nLinked.`)];
      return { path };
    }),
    createReference: fn(async (_pid: string, name: string) => {
      const n = name.replace(/\.md$/i, '').toUpperCase();
      list = [...list, doc(`docs/${n}.md`, `# ${n}\n\n`)];
      return { path: `docs/${n}.md` };
    }),
    removeReference: fn(async (_pid: string, path: string) => {
      list = list.filter((d) => d.path !== path);
    }),
    referenceDraftCopy: fn(async () => ({ path: 'CLAUDE.draft.md' })),
    files: fn(async () => ['docs/ARCHITECTURE.md', 'docs/DEPLOY.md', 'README.md', 'docs/DATA-MODEL.md', 'CLAUDE.md']),
  };
}

const meta = {
  title: 'Modals/References',
  component: ReferencesModal,
  args: { pid: 'p1', toast: fn(), onClose: fn() },
} satisfies Meta<typeof ReferencesModal>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ReadMode: Story = {
  args: { client: client() },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await c.findByText('How Claude works in this repo.');
    expect(c.getAllByRole('tab').map((t) => t.textContent)).toEqual(['CLAUDE.md', 'CONTEXT.md', 'RULES.md', 'API-NOTES.md']);
    await userEvent.click(c.getByRole('tab', { name: 'API-NOTES.md' }));
    expect(c.getByText('File not found')).toBeTruthy();
    await userEvent.click(c.getByRole('tab', { name: 'CLAUDE.md' }));
  },
};

export const EditMode: Story = {
  args: { client: client() },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await c.findByText('How Claude works in this repo.');
    await userEvent.click(c.getByRole('button', { name: '✎ Edit' }));
    expect(c.getByText('Editing CLAUDE.md')).toBeTruthy();
    const ta = c.getByRole('textbox', { name: 'Document markdown' });
    await userEvent.type(ta, '\n- Never skip **review**');
    expect(c.getByText('review').tagName).toBe('STRONG');
  },
};

export const AddMenu: Story = {
  args: { client: client() },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await c.findByText('How Claude works in this repo.');
    await userEvent.click(c.getByRole('button', { name: '+ Add' }));
    expect(c.getByText('Pick a Markdown file already in the project')).toBeTruthy();
    expect(c.getByText('Starts an empty file in docs/')).toBeTruthy();
  },
};

export const Link: Story = {
  args: { client: client() },
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await c.findByText('How Claude works in this repo.');
    await userEvent.click(c.getByRole('button', { name: '+ Add' }));
    await userEvent.click(c.getByRole('button', { name: /Link an existing file/ }));
    await userEvent.type(c.getByRole('textbox', { name: 'File path' }), 'docs');
    await c.findByRole('button', { name: 'docs/ARCHITECTURE.md' });
    expect(c.queryByRole('button', { name: 'CLAUDE.md' })).toBeNull();
    await waitFor(() => expect(args.client!.files).toHaveBeenLastCalledWith('p1', 'docs'));
  },
};

export const Create: Story = {
  args: { client: client() },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await c.findByText('How Claude works in this repo.');
    await userEvent.click(c.getByRole('button', { name: '+ Add' }));
    await userEvent.click(c.getByRole('button', { name: /Create a new document/ }));
    await userEvent.type(c.getByRole('textbox', { name: 'Document name' }), 'deploy');
    expect(c.getByText('Saved as docs/DEPLOY.md')).toBeTruthy();
    await userEvent.click(c.getByRole('button', { name: 'Create' }));
    await c.findByText('Editing docs/DEPLOY.md');
  },
};

const MANY = ['CLAUDE.md', 'docs/CONTEXT.md', 'docs/RULES.md', 'docs/API-NOTES.md', 'docs/STYLE-GUIDE.md', 'docs/ARCHITECTURE.md', 'docs/DEPLOY.md', 'docs/DATA-MODEL.md', 'docs/TESTING.md'].map(
  (p) => doc(p, `# ${p}\n\nReference text.`),
);

export const ManyTabsOverflowing: Story = {
  args: { client: client(MANY) },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await c.findAllByText('Reference text.');
    const right = await c.findByRole('button', { name: 'Scroll tabs right' });
    expect(c.queryByRole('button', { name: 'Scroll tabs left' })).toBeNull();
    await userEvent.click(right);
    await c.findByRole('button', { name: 'Scroll tabs left' });
  },
};
