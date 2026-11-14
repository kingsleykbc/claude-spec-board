import { TOUR_KEY } from '../lib/tour';

// The first-time tour would start in every App test; mark it seen. Tour tests clear this themselves.
try {
  localStorage.setItem(TOUR_KEY, 'seen');
} catch {
  // no storage
}
