import { setProjectAnnotations } from '@storybook/react-vite';
import previewAnnotations from '../../.storybook/preview';
import { TOUR_KEY } from '../lib/tour';

// Stories rendered with composeStories get the preview's decorators (theme, TooltipProvider) and globals.
setProjectAnnotations([previewAnnotations]);

// The first-time tour would start in every App test; mark it seen. Tour tests clear this themselves.
try {
  localStorage.setItem(TOUR_KEY, 'seen');
} catch {
  // no storage
}

// Browser APIs Radix and vaul call. happy-dom 18 has ResizeObserver, matchMedia and scrollIntoView but no
// pointer capture (vaul captures the pointer when a drawer is pressed); each stub only fills a gap.
const proto = Element.prototype as Partial<Pick<Element, 'hasPointerCapture' | 'setPointerCapture' | 'releasePointerCapture' | 'scrollIntoView'>>;
proto.hasPointerCapture ??= () => false;
proto.setPointerCapture ??= () => {};
proto.releasePointerCapture ??= () => {};
proto.scrollIntoView ??= () => {};
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
