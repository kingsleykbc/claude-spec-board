---
id: T-103
title: "Search & filters"
status: review
urgency: high
categories:
  - Frontend
  - Backend
depends_on:
  - T-102
draft: false
milestone: Basics
current_subtask: null
created: 2026-11-01
updated: 2026-11-08
---

## Spec

Full-text search over titles and ingredients, plus filters for **tags** and **cook time**. Results update as you type.

## Features

- SQLite FTS5 index on title and ingredients
- 200 ms debounce on the search input
- Filters combine with search, shown as removable chips

## Open questions



## Subtasks

- [x] 1. Search index on titles and ingredients
- [x] 2. Search input with debounce
- [x] 3. Tag filter
- [x] 4. Cook time filter
- [x] 5. Combine search and filters
- [x] 6. Edge-case tests

## Review notes

Try searching for `tomato` with the **Under 30 min** filter on. Results should update without a page reload.
