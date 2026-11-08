# M2 manual check

Date: 2026-11-08. Branch `m2-board`.

**Setup.** I ran `npm run board -- examples/recipe-box --no-open --port 4981` with `SPECBOARD_HOME` set to a temp dir, so the real `~/.specboard/projects.json` was not touched. The web build ran first, then the server printed `Spec Board running at http://127.0.0.1:4981`. Everything was checked in the Claude desktop built-in browser at a 1024x768 viewport. The prototype `docs/design/Spec Board.dc.html` was served over a throwaway local static server (`http-server` on port 4982), because the pane cannot screenshot `file://` URLs.

| # | Item | Result | Note (what the screenshot showed) |
|---|------|--------|-----------------------------------|
| 1 | Board matches the prototype's layout and colours in both themes | PASS | In both themes the top bar, filter bar, wait chips, four columns, tinted Review column with "Needs you", cards, progress bars, the urgency, Blocked and category pills, and the FAB all match. The theme toggle switches both apps. The only differences come from the prototype's demo data: it has a 10th to-do spec and a simulated "Claude is working" run pill on T-104, which is M3. |
| 2 | Dragging T-103 to Done shows the toast "T-103 approved" and changes the file | PASS | The toast showed "T-103 approved / Moved to Done.", the Review column went empty ("Nothing waiting on you"), and the counter went 3/9 to 4/9. `git diff` showed `status: review` changed to `status: done` in T-103's spec.md. |
| 3 | Editing T-101's spec.md in an editor updates the board within a second, with a flash | PASS | I changed the title from a shell with `sed -i`. The card retitled and got the flash tint. A MutationObserver saw the new title within about 380 ms of the write. |
| 4 | The T-105 answers save to the file | PASS | I answered Yes, 2 and CSV, then clicked Save changes. Each question showed "✓ Answered", and the file read `- [x] Q1 … > answer: Yes`, `Q2 … 2` and `Q3 … CSV`. The "3 questions for you" wait chip disappeared. |
| 5 | The conflict dialog appears when the file is edited during a spec edit | PASS | I opened the Spec editor, typed a line, edited the file from a shell, and clicked Save. The dialog "This spec changed outside the board" appeared, with the buttons Keep editing, Reload & keep my copy, and Reload. After Reload, the file kept the external edit and not the board's typed line. |
| 6 | The overview export downloads the file | PASS | Export .md triggered an `<a download="recipe-box-overview.md">` with a blob holding the Ruling 4 format (name, description, Counts, Progress). I captured the anchor click in the page so that no real file landed in the Downloads folder. |
| 7 | Creating and removing a reference works | PASS | + Add, then "Create a new document", then `DEPLOY.md`. This created `docs/DEPLOY.md`, linked it in config.md, and opened the editor on the new tab. Remove from list, then the "Remove DEPLOY.md from references?" dialog, then Remove link. That unlinked it and kept the file. Observation, not a failure: core rewrote config.md's `references:` block list as a one-line flow list (`[a, b, …]`). |
| 8 | Stopping the server shows Reconnecting… then Disconnected, and restarting it recovers | PASS | I killed the server process. The status went Live, then Reconnecting (immediately), then Disconnected (about 9.6 s later). I restarted it with the same command, and the status returned to Live on its own with no reload. |

**Afterwards.** I stopped both servers, ran `git checkout -- examples/recipe-box`, and removed the `examples/recipe-box/docs/DEPLOY.md` that the check created. `git status --short examples` prints nothing.

**Minor observations (not failures):**
- The two choices in the reference "+ Add" menu have no accessible name in the accessibility tree; read_page lists them as bare `button` entries.
- The Overview counts archived specs as Done ("Done: 4" with 3 done on the board plus 1 archived). This is consistent with the top-bar progress rule.
