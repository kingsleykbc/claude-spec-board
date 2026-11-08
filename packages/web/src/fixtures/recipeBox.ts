import type { Spec } from '@specboard/core';

// Typed fixtures of examples/recipe-box (T-100 archived, T-101..T-108) plus T-109, a spec with a file problem.
// Generated once from loadProject(); edit by hand if the sample changes.

export const recipeSpecs: Spec[] = [
  {
    "id": "T-101",
    "title": "Recipe list page",
    "status": "done",
    "urgency": "normal",
    "categories": [
      "Frontend"
    ],
    "dependsOn": [],
    "draft": false,
    "currentSubtask": null,
    "created": "2026-11-01",
    "updated": "2026-11-08",
    "specMd": "A grid of saved recipes with photo, cook time and tags. Loads from the local API and handles empty and loading states.",
    "featuresMd": "- Responsive grid, 1 to 4 columns\n- Card shows photo, title, cook time and tags\n- Skeleton cards while loading",
    "questions": [],
    "subtasks": [
      {
        "n": 1,
        "title": "Recipe card component",
        "done": true,
        "line": 30,
        "hasLog": false
      },
      {
        "n": 2,
        "title": "Grid layout",
        "done": true,
        "line": 31,
        "hasLog": false
      },
      {
        "n": 3,
        "title": "Load from API",
        "done": true,
        "line": 32,
        "hasLog": false
      },
      {
        "n": 4,
        "title": "Empty and loading states",
        "done": true,
        "line": 33,
        "hasLog": false
      }
    ],
    "problems": [],
    "dir": "examples/recipe-box/.specboard/specs/T-101-recipe-list-page",
    "path": "examples/recipe-box/.specboard/specs/T-101-recipe-list-page/spec.md",
    "hash": "513c9e2e3a1e5b88c31ba45a314a6d02480970231a84429283fe409c8b5a3470",
    "archived": false,
    "slug": "recipe-list-page",
    "progress": {
      "done": 4,
      "total": 4
    },
    "logs": {},
    "bodyMd": "A grid of saved recipes with photo, cook time and tags. Loads from the local API and handles empty and loading states.\n\n## Features\n\n- Responsive grid, 1 to 4 columns\n- Card shows photo, title, cook time and tags\n- Skeleton cards while loading",
    "dependents": [],
    "blocked": false,
    "blockedReasons": []
  },
  {
    "id": "T-102",
    "title": "Add recipe form",
    "status": "done",
    "urgency": "normal",
    "categories": [
      "Frontend"
    ],
    "dependsOn": [],
    "draft": false,
    "currentSubtask": null,
    "created": "2026-11-01",
    "updated": "2026-11-08",
    "specMd": "Form to add a recipe with ingredients, steps and an optional photo. Validates required fields and saves through the API.",
    "featuresMd": "- Ingredient rows with quantity, unit and name\n- Reorderable steps\n- Optional photo, resized on upload",
    "questions": [],
    "subtasks": [
      {
        "n": 1,
        "title": "Form fields",
        "done": true,
        "line": 30,
        "hasLog": false
      },
      {
        "n": 2,
        "title": "Ingredient rows",
        "done": true,
        "line": 31,
        "hasLog": false
      },
      {
        "n": 3,
        "title": "Step list",
        "done": true,
        "line": 32,
        "hasLog": false
      },
      {
        "n": 4,
        "title": "Photo upload",
        "done": true,
        "line": 33,
        "hasLog": false
      },
      {
        "n": 5,
        "title": "Validation and save",
        "done": true,
        "line": 34,
        "hasLog": false
      }
    ],
    "problems": [],
    "dir": "examples/recipe-box/.specboard/specs/T-102-add-recipe-form",
    "path": "examples/recipe-box/.specboard/specs/T-102-add-recipe-form/spec.md",
    "hash": "8345f50e07c72243fc611908fa026b557e6e60c495754e477e3d51308597f373",
    "archived": false,
    "slug": "add-recipe-form",
    "progress": {
      "done": 5,
      "total": 5
    },
    "logs": {},
    "bodyMd": "Form to add a recipe with ingredients, steps and an optional photo. Validates required fields and saves through the API.\n\n## Features\n\n- Ingredient rows with quantity, unit and name\n- Reorderable steps\n- Optional photo, resized on upload",
    "dependents": [
      "T-103"
    ],
    "blocked": false,
    "blockedReasons": []
  },
  {
    "id": "T-103",
    "title": "Search & filters",
    "status": "review",
    "urgency": "high",
    "categories": [
      "Frontend",
      "Backend"
    ],
    "dependsOn": [
      "T-102"
    ],
    "draft": false,
    "currentSubtask": null,
    "created": "2026-11-01",
    "updated": "2026-11-08",
    "specMd": "Full-text search over titles and ingredients, plus filters for **tags** and **cook time**. Results update as you type.",
    "featuresMd": "- SQLite FTS5 index on title and ingredients\n- 200 ms debounce on the search input\n- Filters combine with search, shown as removable chips",
    "questions": [],
    "subtasks": [
      {
        "n": 1,
        "title": "Search index on titles and ingredients",
        "done": true,
        "line": 32,
        "hasLog": false
      },
      {
        "n": 2,
        "title": "Search input with debounce",
        "done": true,
        "line": 33,
        "hasLog": false
      },
      {
        "n": 3,
        "title": "Tag filter",
        "done": true,
        "line": 34,
        "hasLog": false
      },
      {
        "n": 4,
        "title": "Cook time filter",
        "done": true,
        "line": 35,
        "hasLog": false
      },
      {
        "n": 5,
        "title": "Combine search and filters",
        "done": true,
        "line": 36,
        "hasLog": false
      },
      {
        "n": 6,
        "title": "Edge-case tests",
        "done": true,
        "line": 37,
        "hasLog": false
      }
    ],
    "problems": [],
    "dir": "examples/recipe-box/.specboard/specs/T-103-search-and-filters",
    "path": "examples/recipe-box/.specboard/specs/T-103-search-and-filters/spec.md",
    "hash": "c8dc4a3ea2e3f18d5ff80ccef165a34229318fa15071e0fdfc43a7e775acc6bd",
    "archived": false,
    "slug": "search-and-filters",
    "progress": {
      "done": 6,
      "total": 6
    },
    "logs": {},
    "bodyMd": "Full-text search over titles and ingredients, plus filters for **tags** and **cook time**. Results update as you type.\n\n## Features\n\n- SQLite FTS5 index on title and ingredients\n- 200 ms debounce on the search input\n- Filters combine with search, shown as removable chips\n\n## Review notes\n\nTry searching for `tomato` with the **Under 30 min** filter on. Results should update without a page reload.",
    "dependents": [],
    "blocked": false,
    "blockedReasons": []
  },
  {
    "id": "T-104",
    "title": "Meal planner calendar",
    "status": "doing",
    "urgency": "high",
    "categories": [
      "Frontend"
    ],
    "dependsOn": [],
    "draft": false,
    "currentSubtask": 3,
    "created": "2026-11-01",
    "updated": "2026-11-08",
    "specMd": "A weekly calendar where recipes can be dragged onto days. Planned meals are saved per user and feed the **shopping list** (T-105).",
    "featuresMd": "- Week view, Monday to Sunday, with breakfast, lunch and dinner slots\n- Drag a recipe from the sidebar onto any slot\n- Planned meals persist in `planned_meals` and survive reloads\n- Previous and next week navigation, with **Today** to jump back",
    "questions": [],
    "subtasks": [
      {
        "n": 1,
        "title": "Create calendar grid",
        "done": true,
        "line": 31,
        "hasLog": true
      },
      {
        "n": 2,
        "title": "Drag recipe onto a day",
        "done": true,
        "line": 32,
        "hasLog": true
      },
      {
        "n": 3,
        "title": "Persist planned meals",
        "done": false,
        "line": 33,
        "hasLog": false
      },
      {
        "n": 4,
        "title": "Week navigation",
        "done": false,
        "line": 34,
        "hasLog": false
      },
      {
        "n": 5,
        "title": "Empty-day state",
        "done": false,
        "line": 35,
        "hasLog": false
      }
    ],
    "problems": [],
    "dir": "examples/recipe-box/.specboard/specs/T-104-meal-planner-calendar",
    "path": "examples/recipe-box/.specboard/specs/T-104-meal-planner-calendar/spec.md",
    "hash": "9d54d79c091ac0509466ba1b0b216a0fb5c8b0e6175a2cbbb1618f8f346ffcc6",
    "archived": false,
    "slug": "meal-planner-calendar",
    "progress": {
      "done": 2,
      "total": 5
    },
    "logs": {
      "1": {
        "subtask": 1,
        "commit": "4f2a91c",
        "files": [
          "src/components/WeekGrid.tsx",
          "src/components/WeekGrid.test.tsx",
          "src/pages/Planner.tsx"
        ],
        "entries": [
          {
            "at": "2026-11-07 15:12",
            "text": "Added a WeekGrid component with seven day columns and breakfast, lunch and dinner rows."
          },
          {
            "at": "2026-11-07 15:31",
            "text": "Made slots focusable and added arrow-key navigation between them, as the spec asks."
          }
        ],
        "problems": []
      },
      "2": {
        "subtask": 2,
        "commit": "a1b2c3d",
        "files": [
          "src/components/RecipeSidebar.tsx",
          "src/components/WeekGrid.tsx",
          "src/hooks/useDragRecipe.ts"
        ],
        "entries": [
          {
            "at": "2026-11-07 16:05",
            "text": "Added a draggable recipe sidebar that reuses RecipeCard in a compact size."
          },
          {
            "at": "2026-11-07 16:40",
            "text": "Dropping on an empty slot places the recipe; dropping on a filled slot swaps the two. Both cases are covered by tests."
          }
        ],
        "problems": []
      }
    },
    "bodyMd": "A weekly calendar where recipes can be dragged onto days. Planned meals are saved per user and feed the **shopping list** (T-105).\n\n## Features\n\n- Week view, Monday to Sunday, with breakfast, lunch and dinner slots\n- Drag a recipe from the sidebar onto any slot\n- Planned meals persist in `planned_meals` and survive reloads\n- Previous and next week navigation, with **Today** to jump back\n\n## Notes\n\nReuse the card component from the recipe list. Keep the grid keyboard accessible: arrow keys move between slots and `Enter` opens the recipe picker.",
    "dependents": [
      "T-105"
    ],
    "blocked": false,
    "blockedReasons": []
  },
  {
    "id": "T-105",
    "title": "Shopping list export",
    "status": "todo",
    "urgency": "normal",
    "categories": [
      "Backend"
    ],
    "dependsOn": [
      "T-104"
    ],
    "draft": false,
    "currentSubtask": null,
    "created": "2026-11-01",
    "updated": "2026-11-08",
    "specMd": "Combine the ingredients from every meal in the planned week into one shopping list, then export it so it can be printed or sent to a phone.",
    "featuresMd": "- Collects ingredients from all planned meals in the chosen range\n- Merges duplicates, so **2 x 200 g flour** becomes **400 g flour**\n- Groups items by aisle: produce, dairy, pantry, other\n- Exports in the format chosen below",
    "questions": [
      {
        "id": "Q1",
        "type": "yesno",
        "text": "Should the export include quantities?",
        "options": [],
        "answer": null,
        "line": 28
      },
      {
        "id": "Q2",
        "type": "number",
        "text": "How many weeks ahead should the list cover?",
        "options": [],
        "answer": null,
        "line": 30
      },
      {
        "id": "Q3",
        "type": "choice",
        "text": "Preferred export format?",
        "options": [
          "PDF",
          "CSV",
          "Plain text"
        ],
        "answer": null,
        "line": 32
      }
    ],
    "subtasks": [
      {
        "n": 1,
        "title": "Collect ingredients from planned meals",
        "done": false,
        "line": 37,
        "hasLog": false
      },
      {
        "n": 2,
        "title": "Merge duplicate ingredients",
        "done": false,
        "line": 38,
        "hasLog": false
      },
      {
        "n": 3,
        "title": "Group by aisle",
        "done": false,
        "line": 39,
        "hasLog": false
      },
      {
        "n": 4,
        "title": "Export file",
        "done": false,
        "line": 40,
        "hasLog": false
      },
      {
        "n": 5,
        "title": "Export button on planner",
        "done": false,
        "line": 41,
        "hasLog": false
      }
    ],
    "problems": [],
    "dir": "examples/recipe-box/.specboard/specs/T-105-shopping-list-export",
    "path": "examples/recipe-box/.specboard/specs/T-105-shopping-list-export/spec.md",
    "hash": "52f8c621a40fe395726aa81ed683bc81c537df4b6837f1463724426c3dbd2763",
    "archived": false,
    "slug": "shopping-list-export",
    "progress": {
      "done": 0,
      "total": 5
    },
    "logs": {},
    "bodyMd": "Combine the ingredients from every meal in the planned week into one shopping list, then export it so it can be printed or sent to a phone.\n\n## Features\n\n- Collects ingredients from all planned meals in the chosen range\n- Merges duplicates, so **2 x 200 g flour** becomes **400 g flour**\n- Groups items by aisle: produce, dairy, pantry, other\n- Exports in the format chosen below\n\n## Depends on\n\nNeeds saved meals from T-104 (the `planned_meals` table).",
    "dependents": [],
    "blocked": true,
    "blockedReasons": [
      "3 open questions",
      "Waiting on T-104 (doing)"
    ]
  },
  {
    "id": "T-106",
    "title": "User accounts",
    "status": "todo",
    "urgency": "urgent",
    "categories": [
      "Backend",
      "Auth"
    ],
    "dependsOn": [],
    "draft": false,
    "currentSubtask": null,
    "created": "2026-11-01",
    "updated": "2026-11-08",
    "specMd": "Sign up, sign in and sessions so recipes and plans belong to a person. Email and password first, OAuth later.",
    "featuresMd": "- Passwords hashed with `argon2`\n- HTTP-only session cookie, 30-day expiry\n- All `/api` routes require a session except auth",
    "questions": [
      {
        "id": "Q1",
        "type": "text",
        "text": "Which OAuth providers should come later?",
        "options": [],
        "answer": "Google and GitHub",
        "line": 27
      }
    ],
    "subtasks": [
      {
        "n": 1,
        "title": "Users table",
        "done": false,
        "line": 32,
        "hasLog": false
      },
      {
        "n": 2,
        "title": "Sign up",
        "done": false,
        "line": 33,
        "hasLog": false
      },
      {
        "n": 3,
        "title": "Sign in",
        "done": false,
        "line": 34,
        "hasLog": false
      },
      {
        "n": 4,
        "title": "Sessions",
        "done": false,
        "line": 35,
        "hasLog": false
      },
      {
        "n": 5,
        "title": "Protect API routes",
        "done": false,
        "line": 36,
        "hasLog": false
      },
      {
        "n": 6,
        "title": "Sign out",
        "done": false,
        "line": 37,
        "hasLog": false
      },
      {
        "n": 7,
        "title": "Password reset email",
        "done": false,
        "line": 38,
        "hasLog": false
      }
    ],
    "problems": [],
    "dir": "examples/recipe-box/.specboard/specs/T-106-user-accounts",
    "path": "examples/recipe-box/.specboard/specs/T-106-user-accounts/spec.md",
    "hash": "3e3a9d9246492cfb34970789ee60323f4dccb3af6eae742fe1e1c78724d54fc1",
    "archived": false,
    "slug": "user-accounts",
    "progress": {
      "done": 0,
      "total": 7
    },
    "logs": {},
    "bodyMd": "Sign up, sign in and sessions so recipes and plans belong to a person. Email and password first, OAuth later.\n\n## Features\n\n- Passwords hashed with `argon2`\n- HTTP-only session cookie, 30-day expiry\n- All `/api` routes require a session except auth",
    "dependents": [
      "T-108"
    ],
    "blocked": false,
    "blockedReasons": []
  },
  {
    "id": "T-107",
    "title": "Dark mode",
    "status": "todo",
    "urgency": "low",
    "categories": [
      "Frontend"
    ],
    "dependsOn": [],
    "draft": true,
    "currentSubtask": null,
    "created": "2026-11-01",
    "updated": "2026-11-08",
    "specMd": "Respect the system theme and add a manual toggle in settings.",
    "featuresMd": "",
    "questions": [],
    "subtasks": [],
    "problems": [],
    "dir": "examples/recipe-box/.specboard/specs/T-107-dark-mode",
    "path": "examples/recipe-box/.specboard/specs/T-107-dark-mode/spec.md",
    "hash": "409b1740aeeb5b28aef6dee33de73aadb52b4b3a210c5952127431c627b7224f",
    "archived": false,
    "slug": "dark-mode",
    "progress": {
      "done": 0,
      "total": 0
    },
    "logs": {},
    "bodyMd": "Respect the system theme and add a manual toggle in settings.\n\n## Features",
    "dependents": [],
    "blocked": false,
    "blockedReasons": []
  },
  {
    "id": "T-108",
    "title": "Share recipe link",
    "status": "todo",
    "urgency": "normal",
    "categories": [
      "Frontend"
    ],
    "dependsOn": [
      "T-106"
    ],
    "draft": false,
    "currentSubtask": null,
    "created": "2026-11-01",
    "updated": "2026-11-08",
    "specMd": "Generate a public, read-only link for a single recipe that anyone can open without an account.",
    "featuresMd": "- Unguessable token per recipe\n- Owner can revoke the link\n- Shared page hides edit controls",
    "questions": [],
    "subtasks": [
      {
        "n": 1,
        "title": "Public share token",
        "done": false,
        "line": 31,
        "hasLog": false
      },
      {
        "n": 2,
        "title": "Read-only recipe page",
        "done": false,
        "line": 32,
        "hasLog": false
      },
      {
        "n": 3,
        "title": "Copy link button",
        "done": false,
        "line": 33,
        "hasLog": false
      },
      {
        "n": 4,
        "title": "Revoke link",
        "done": false,
        "line": 34,
        "hasLog": false
      }
    ],
    "problems": [],
    "dir": "examples/recipe-box/.specboard/specs/T-108-share-recipe-link",
    "path": "examples/recipe-box/.specboard/specs/T-108-share-recipe-link/spec.md",
    "hash": "69e80c5c725d2c77a49b34079728d62754808a1dc85136b591e98675a8d550de",
    "archived": false,
    "slug": "share-recipe-link",
    "progress": {
      "done": 0,
      "total": 4
    },
    "logs": {},
    "bodyMd": "Generate a public, read-only link for a single recipe that anyone can open without an account.\n\n## Features\n\n- Unguessable token per recipe\n- Owner can revoke the link\n- Shared page hides edit controls",
    "dependents": [],
    "blocked": true,
    "blockedReasons": [
      "Waiting on T-106 (todo)"
    ]
  }
];

export const recipeArchived: Spec[] = [
  {
    "id": "T-100",
    "title": "Project scaffold",
    "status": "done",
    "urgency": "normal",
    "categories": [
      "Infra"
    ],
    "dependsOn": [],
    "draft": false,
    "currentSubtask": null,
    "created": "2026-11-01",
    "updated": "2026-11-08",
    "specMd": "Vite, React and TypeScript setup with routing, linting and a CI check on every push.",
    "featuresMd": "- Vite dev server and production build\n- React Router with a layout route\n- ESLint and Prettier on commit",
    "questions": [],
    "subtasks": [
      {
        "n": 1,
        "title": "Init Vite project",
        "done": true,
        "line": 30,
        "hasLog": false
      },
      {
        "n": 2,
        "title": "Add router",
        "done": true,
        "line": 31,
        "hasLog": false
      },
      {
        "n": 3,
        "title": "Lint and format",
        "done": true,
        "line": 32,
        "hasLog": false
      },
      {
        "n": 4,
        "title": "CI workflow",
        "done": true,
        "line": 33,
        "hasLog": false
      }
    ],
    "problems": [],
    "dir": "examples/recipe-box/.specboard/archive/T-100-project-scaffold",
    "path": "examples/recipe-box/.specboard/archive/T-100-project-scaffold/spec.md",
    "hash": "ddd3200424e38aa42dda695d6c4ec5ab58191b728bf2d6bdfacc8009f1721b57",
    "archived": true,
    "slug": "project-scaffold",
    "progress": {
      "done": 4,
      "total": 4
    },
    "logs": {},
    "bodyMd": "Vite, React and TypeScript setup with routing, linting and a CI check on every push.\n\n## Features\n\n- Vite dev server and production build\n- React Router with a layout route\n- ESLint and Prettier on commit",
    "dependents": [],
    "blocked": false,
    "blockedReasons": []
  }
];

/** A to-do spec whose file has a problem (File problem card state). */
export const fileProblemSpec: Spec = {
  "id": "T-109",
  "title": "Import recipes from a file",
  "status": "todo",
  "urgency": "low",
  "categories": [
    "Backend"
  ],
  "dependsOn": [],
  "draft": false,
  "currentSubtask": null,
  "created": "2026-11-01",
  "updated": "2026-11-08",
  "specMd": "Import a folder of recipe files in one go. Skips duplicates and reports what it could not read.",
  "featuresMd": "- Accepts JSON and plain text\n- Skips duplicates",
  "questions": [],
  "subtasks": [
    {
      "n": 1,
      "title": "Parse the file formats",
      "done": false,
      "line": 17,
      "hasLog": false
    },
    {
      "n": 2,
      "title": "Skip duplicates",
      "done": false,
      "line": 18,
      "hasLog": false
    }
  ],
  "problems": [
    "The subtask on line 18 is missing its checkbox…"
  ],
  "dir": "examples/recipe-box/.specboard/specs/T-109-import-recipes-from-a-file",
  "path": "examples/recipe-box/.specboard/specs/T-109-import-recipes-from-a-file/spec.md",
  "hash": "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  "archived": false,
  "slug": "import-recipes-from-a-file",
  "progress": {
    "done": 0,
    "total": 2
  },
  "logs": {},
  "bodyMd": "Import a folder of recipe files in one go. Skips duplicates and reports what it could not read.\n\n## Features\n\n- Accepts JSON and plain text\n- Skips duplicates",
  "dependents": [],
  "blocked": false,
  "blockedReasons": []
};

/** Every fixture spec: active, the file-problem one, then archived. */
export const allRecipeSpecs: Spec[] = [...recipeSpecs, fileProblemSpec, ...recipeArchived];

/** Look a fixture spec up by ID; throws if missing. */
export function recipeSpec(id: string): Spec {
  const s = allRecipeSpecs.find((x) => x.id === id);
  if (!s) throw new Error(`No fixture spec ${id}`);
  return s;
}
