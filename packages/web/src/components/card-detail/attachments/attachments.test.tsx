import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { composeStories } from '@storybook/react-vite';
import type { Spec } from '@specboard/core';
import { recipeSpec } from '@/fixtures/recipeBox';
import * as stories from './attachments.stories';

const { Default } = composeStories(stories);

function setup(sp: Spec = recipeSpec('T-104'), opts: { upload?: () => Promise<{ path: string }>; down?: boolean } = {}) {
  const client = {
    uploadImage: vi.fn(opts.upload ?? (async (..._a: unknown[]) => ({ path: 'images/new.png' }))),
    deleteImage: vi.fn(async (..._a: unknown[]) => undefined),
  };
  const toast = vi.fn();
  const refresh = vi.fn(async () => undefined);
  const view = render(<Default pid="p1" spec={sp} client={client as never} refresh={refresh} toast={toast} down={opts.down ?? false} />);
  return { client, toast, refresh, view };
}
const png = (name = 'shot.png') => new File(['x'], name, { type: 'image/png' });
const input = () => screen.getByTestId('attachment-input') as HTMLInputElement;

afterEach(cleanup);

describe('Attachments', () => {
  it('shows a thumbnail per attachment through the image route', () => {
    setup();
    expect(screen.getByText('ATTACHMENTS')).toBeTruthy();
    const img = screen.getByRole('button', { name: 'View wireframe.svg' }).querySelector('img')!;
    const dir = recipeSpec('T-104').dir.replace(/^.*?(\.specboard\/)/, '$1');
    expect(img.getAttribute('src')).toBe(`/api/projects/p1/image?path=${encodeURIComponent(`${dir}/images/wireframe.svg`)}`);
  });

  it('shows the empty state for an active spec with none', () => {
    setup({ ...recipeSpec('T-105'), attachments: [] });
    expect(screen.getByText('No attachments. Add images Claude should look at.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add image' })).toBeTruthy();
  });

  it('Add image uploads through the route, then reloads', async () => {
    const { client, refresh } = setup();
    fireEvent.change(input(), { target: { files: [png()] } });
    await waitFor(() => expect(client.uploadImage).toHaveBeenCalledTimes(1));
    expect(client.uploadImage.mock.calls[0]![0]).toBe('p1');
    expect(client.uploadImage.mock.calls[0]![1]).toBe('T-104');
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('dropping an image on the section uploads it', async () => {
    const { client, view } = setup();
    fireEvent.drop(view.container.querySelector('[data-section="attachments"]')!, { dataTransfer: { files: [png('drop.png')], types: ['Files'] } });
    await waitFor(() => expect(client.uploadImage).toHaveBeenCalledTimes(1));
  });

  it('refuses a file that is not an accepted image', async () => {
    const { client, toast } = setup();
    fireEvent.change(input(), { target: { files: [new File(['x'], 'notes.txt', { type: 'text/plain' }), new File(['x'], 'fake.bmp', { type: 'image/bmp' })] } });
    await waitFor(() => expect(toast).toHaveBeenCalledWith('err', 'Couldn’t add the image', expect.stringContaining('PNG')));
    expect(client.uploadImage).not.toHaveBeenCalled();
  });

  it('an upload failure toasts and still reloads', async () => {
    const { toast, refresh } = setup(recipeSpec('T-104'), { upload: () => Promise.reject(new Error('Too big')) });
    fireEvent.change(input(), { target: { files: [png()] } });
    await waitFor(() => expect(toast).toHaveBeenCalledWith('err', 'Couldn’t add the image', 'Too big'));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('clicking a thumbnail opens a larger view in a dialog that closes', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'View wireframe.svg' }));
    const dlg = screen.getByRole('dialog', { name: 'wireframe.svg' });
    expect(dlg.querySelector('img')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'wireframe.svg' })).toBeNull();
  });

  it('delete asks first: No keeps it, Yes calls the route and reloads', async () => {
    const { client, refresh } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Delete wireframe.svg' }));
    expect(client.deleteImage).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(screen.getByRole('button', { name: 'Delete wireframe.svg' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete wireframe.svg' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    await waitFor(() => expect(client.deleteImage).toHaveBeenCalledWith('p1', 'T-104', 'wireframe.svg'));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('is read-only for an archived spec', () => {
    setup({ ...recipeSpec('T-104'), archived: true });
    expect(screen.queryByRole('button', { name: 'Add image' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Delete / })).toBeNull();
    expect(screen.getByRole('button', { name: 'View wireframe.svg' })).toBeTruthy();
  });

  it('is hidden for an archived spec with none', () => {
    const { view } = setup({ ...recipeSpec('T-104'), archived: true, attachments: [] });
    expect(view.container.querySelector('[data-section="attachments"]')).toBeNull();
  });
});
