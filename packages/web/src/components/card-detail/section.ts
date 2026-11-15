// The framed sections of the card detail body (SPEC, OPEN QUESTIONS, DEPENDENCIES, SUBTASKS) share these classes.
// A section the blocked banner scrolls to sets `data-highlight="true"` and gets the accent border for a moment.

export const section =
  'flex-none overflow-hidden rounded-xl border border-line transition-[border-color] duration-[400ms] data-[highlight=true]:border-accent';

/** The bar at the top of a section: its label and, on the right, its counts or buttons. */
export const sectionHead = 'flex items-center gap-2.5 border-b border-line bg-bg px-4 py-2.5';

/** The small uppercase name of a section (SPEC, SUBTASKS, ...). */
export const sectionLabel = 'text-[11.5px] font-semibold tracking-[0.09em] text-fg2';
