# Rules

- Never add a dependency without noting it in the spec log
- No `any` in TypeScript
- Keep components under 200 lines; split when larger
- **Don't** touch `server/db/migrations` by hand; use `npm run migrate:new`
