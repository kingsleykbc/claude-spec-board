# Milestone 1: deferred follow-ups

These items came up in the M1 reviews and were deliberately left out of M1. Read this list when planning M2.

## Likely to matter in M2 (server + board)
- **Cross-process write race:** `writeIfUnchanged` locks within one process and re-hashes just before the rename. A Claude write landing in the same instant can still be overwritten, and that is a documented known limit.
- **Archiving has no lock:** `archiveSpec`/`unarchiveSpec` aren't locked, so a create or archive running at the same time as another archive isn't serialised.
- **Reads have no retry:** a transient EBUSY/EPERM on Windows drops a spec from the load with a problem. The server should retry reads.
- **Watcher:** chokidar should ignore `*.tmp`. Windows directory handles may block archive renames longer than the 250 ms retry.
- **Archive destination already exists:** this gives a raw EPERM. It should throw a clear error.
- **ID sorting:** add a numeric `compareIds` export, because `byId` sorts as strings (T-1000 < T-999).
- **`nextId` reads folder names only:** it ignores front-matter IDs, so a mis-named folder can lead to an ID being reused.
- **Single-file refresh:** add a `loadSpec(dir)` export so the server doesn't re-read every spec on each change.

## Hand-edit tolerance (nice to have)
- `status: Done` (wrong case) is rejected. A string `depends_on: T-2, T-3` becomes one ID. A second answer line after a blank line is left orphaned.
- Non-UTF-8 files are rewritten with replacement characters. Refuse the write when the bytes don't round-trip.
- An unclosed code fence in user text can swallow later headings.
- Parsing questions and subtasks isn't fence-aware. A choice question with no options, duplicate question IDs, and `)` inside options aren't handled.
- `current_subtask` / log `subtask` coercion of `""` or `true`.
- `initProject` doesn't fill in a partial setup, and `createSpec` on a root that hasn't been initialised leaves no config.md.

## Code and test hygiene
- `stringList`/`optionalString`/YAML-mapping helpers are duplicated between `parseOther.ts` and `frontmatter.ts`.
- Weak tests: the broken-YAML and unknown-type tests only check counts; there's no real check that archived specs count as done; and 'Missing config.md' is untested.
- `listDirs` swallows every error, including EACCES, and skips symlinked folders.
- Editing a key drops its inline comment, and an indented comment before the next key is removed.
- `replaceSection` collapses several trailing blank lines at the end of the file.
