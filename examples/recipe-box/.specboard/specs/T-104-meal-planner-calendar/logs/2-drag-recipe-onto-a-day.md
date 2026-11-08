---
subtask: 2
commit: a1b2c3d
files:
  - src/components/RecipeSidebar.tsx
  - src/components/WeekGrid.tsx
  - src/hooks/useDragRecipe.ts
---

### 2026-11-07 16:05

Added a draggable recipe sidebar that reuses RecipeCard in a compact size.

### 2026-11-07 16:40

Dropping on an empty slot places the recipe; dropping on a filled slot swaps the two. Both cases are covered by tests.
