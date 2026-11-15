/**
 * True while a menu, popover or drawer is open over the page: a Radix popper layer holding a menu or a
 * dialog (not a tooltip), or a vaul drawer. A scrim press that lands while one is open only closes that
 * layer (Radix and vaul close it on the outside press), so Modal and ConfirmDialog skip closing for it.
 */
const LAYERS = [
  '[data-radix-popper-content-wrapper] > [role="menu"]',
  '[data-radix-popper-content-wrapper] > [role="dialog"]',
  '[data-radix-popper-content-wrapper] > [role="listbox"]',
  '[data-vaul-drawer]',
].join(', ');

export function layerOpen(doc: Document = document): boolean {
  return doc.querySelector(LAYERS) !== null;
}
