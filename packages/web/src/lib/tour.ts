import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import './tour.css';

// The first-time tour: a few bubbles that point at the main parts of the board.
// It starts by itself once per browser and can be replayed from the menu under the logo.

/** localStorage key that says the tour has been seen. */
export const TOUR_KEY = 'specboard.tour';

/** True when the tour has been seen (or storage is blocked, so it does not show on every load). */
export function tourSeen(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === 'seen';
  } catch {
    return true;
  }
}

export function markTourSeen(): void {
  try {
    localStorage.setItem(TOUR_KEY, 'seen');
  } catch {
    // storage blocked
  }
}

interface TourStep {
  /** A `data-tour` value; no target means a centred bubble. */
  target?: string;
  title: string;
  text: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

export const TOUR_STEPS: TourStep[] = [
  {
    title: 'Welcome to Spec Board',
    text: 'Each card is one spec: a Markdown file in your project’s <code>.specboard/</code> folder. This quick tour shows you around. You can skip it at any time.',
  },
  {
    target: 'columns',
    title: 'The four columns',
    text: '<b>To do</b>, <b>Doing</b>, <b>Review</b> and <b>Done</b>. Claude moves cards as it works and stops at Review; only you move a card to Done. Drag a card to move it yourself.',
    side: 'top',
  },
  {
    target: 'card',
    title: 'A spec card',
    text: 'Shows the title, progress and anything waiting on you. Click it to open the details: the spec, open questions, subtasks and logs, and the button to run it with Claude.',
    side: 'right',
  },
  {
    target: 'filters',
    title: 'Filters and Simple mode',
    text: 'Switch between Board and Table views. Narrow the specs by category, urgency or blocked cards. <b>Simple mode</b> hides the extra detail when you just want to follow the work.',
    side: 'bottom',
  },
  {
    target: 'project',
    title: 'References and Overview',
    text: '<b>References</b> lists the docs Claude reads for this project. <b>Overview</b> is a short write-up of where the whole project stands.',
    side: 'bottom',
  },
  {
    target: 'add',
    title: 'Add a spec',
    text: 'Jot down an idea and let Claude write it up, or ask Claude in your chat with <code>/create-spec</code>. Cards appear here as soon as the files exist.',
    side: 'top',
  },
  {
    target: 'brand',
    title: 'Docs and this tour',
    text: 'The menu under the logo has the documentation, and <b>Take the tour</b> if you want to see this again.',
    side: 'bottom',
  },
];

/** Targets found without a data-tour marker of their own: the first card on the board. */
const TARGETS: Record<string, string> = { card: '[data-tour="columns"] [role="button"][aria-label]' };

/** The steps whose targets are on screen (a board with no cards has no card step). */
export function tourSteps(root: ParentNode = document): DriveStep[] {
  const steps: DriveStep[] = [];
  for (const st of TOUR_STEPS) {
    const popover = { title: st.title, description: st.text, ...(st.side ? { side: st.side, align: 'start' as const } : {}) };
    if (!st.target) {
      steps.push({ popover });
      continue;
    }
    const el = root.querySelector<HTMLElement>(TARGETS[st.target] ?? `[data-tour="${st.target}"]`);
    if (el) steps.push({ element: el, popover });
  }
  return steps;
}

/** Start the tour. It counts as seen once shown, so a reload part-way through does not bring it back. */
export function startTour(): void {
  markTourSeen();
  const d = driver({
    steps: tourSteps(),
    showProgress: true,
    progressText: '{{current}} / {{total}}',
    nextBtnText: 'Next',
    prevBtnText: 'Previous',
    doneBtnText: 'Done',
    popoverClass: 'sb-tour',
    overlayOpacity: 0.45,
    stagePadding: 6,
    stageRadius: 10,
  });
  d.drive();
}
