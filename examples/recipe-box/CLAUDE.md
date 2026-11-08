# Recipe Box

Project instructions for Claude Code. Read this before starting any spec.

## Stack
- React 18 and TypeScript, built with Vite
- Express API in `server/`, SQLite through `better-sqlite3`
- Tests with Vitest. Run `npm test` before every commit

## Working on specs
- Specs live in `.specboard/specs/<ID>-<slug>/spec.md`
- Work through subtasks in order and commit after each one
- If a decision isn't covered by the spec, add an open question and stop

## Commits
Use the subtask name as the message, prefixed with the spec ID, e.g. `T-104: Persist planned meals`.
