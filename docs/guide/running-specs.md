# Running a spec

There are two ways to have Claude work on a spec, and the card shows both: **Run with Claude** (the main button) and **Copy run command**. **Use your chat unless you have a reason not to.** Use the background when you don't fully trust the repo, or don't want to sit with a chat.

| | In your Claude chat | In the background |
|---|---|---|
| **How to start** | Press **Copy run command** on the card and paste it into a chat, or type `/specboard:run-spec T-001` | Press **Run with Claude** on the card |
| **Where you watch it** | In the chat, in full | On the card, as a short list of steps |
| **When Claude needs an action approved** | It asks you in the chat | It can't ask. Anything you haven't approved is refused and the run stops |
| **Your Claude settings, plugins and MCP servers** | Apply as usual | Off (only Spec Board's own plugin is loaded) |
| **The project's hooks, MCP servers and settings** | Apply as usual | Off |
| **To stop it** | Press Esc in the chat | Press **Stop** on the card |
| **Setup it needs** | The plugin (or the commands `init` copied), the chat is open in the project folder, and you trusted that folder when Claude asked | Background runs turned on for the project (see below) |

## Run with Claude or Copy run command

**Run with Claude** is the main button on a card. When Claude is connected, it starts a background run and shows a toast, "Claude started working on T-001 in the background." The card then says "Running in the background as a separate Claude session. It won't show in your terminal chat; follow it here." When Claude isn't connected, the button shows the [not connected](running-specs.md#when-claude-isnt-connected) notice instead.

**Copy run command** is the alternative. It copies `/specboard:run-spec T-001` for you to paste into a chat.

While Claude works on a spec in a chat, the card shows "Claude is working on step 2 in a chat". The board can't tell when a chat is closed, so the marker can outlast the work. If nothing is running, press **Not running? Clear** in the card's detail. It removes the marker and changes nothing else.

## Turn on background runs

Background runs need two things: Claude Code installed and logged in, and your approval of the actions a run may use. Until both are true, Claude isn't connected to the board (next section).

- **With the plugin:** run `/specboard:setup`. When it asks about background runs, it shows the actions and writes them once you say yes. In a project that already has `.specboard/`, ask Claude to turn runs on. It runs `specboard init --yes --no-skills --runs yes "<project folder>"` for you (`--no-skills` keeps `init` from copying commands that the plugin already has).
- **From a terminal, without the plugin:** run `npm run specboard -- init "<project folder>"` from a copy of the repo. It shows the list of actions and asks you to approve it.

The approved list is kept in `~/.specboard/`, outside the repo. [Safety](safety.md) explains what it lets a run do.

## When Claude isn't connected

When background runs can't happen for a project, because Claude Code isn't installed, isn't logged in, is blocked by a setting, or the project hasn't been approved for runs, the board shows a small "not connected" icon in the header. Hover it (or focus it with the keyboard, or tap it on a phone) to see **Claude isn't connected to the board**, the reason, and a link to this page.

The board still works fully as a view of your files. It just can't start Claude, so use the **Copy command** buttons and paste the command into a Claude chat in the project folder.

## Why the chat is the usual choice

You see all of Claude's work in the place you already work, and you can step in, answer or redirect it there. The board can't type into a chat that's already open, so **Copy run command** copies `/specboard:run-spec T-001` for you to paste.

Your chat is the less restricted of the two. A project's hooks and MCP servers run there, as they do in any Claude Code session in that folder. If you don't trust a repo, that's the difference that matters, and it's the reason the background run stays.

## Why the background run stays

It's already isolated from the repo's Claude settings, so a repo can't add hooks to it or widen what it may do. It also runs without tying up a chat. [Safety](safety.md) has the limits: the project's tests and git hooks still run with your rights.

## What the board shows during a chat run

The board follows the files. While Claude works in your chat, the card moves to Doing, shows the current subtask, ticks subtasks off and shows their logs and commits, then moves to Review.

It doesn't show Claude's messages or the commands it runs. Those stay in the chat, and the **Run output** panel only appears for background runs.

## What a log records

Each finished subtask has a log. Besides what was done, the card shows:

- **The commit**, and the **pull request** (or merge request) link when the branch has one. Claude looks for it with `gh pr view`, then `glab mr view`, and quietly skips it when neither finds one.
- **When it was done**, as a date and time in your local time.
- **Tokens**, described next.

- **A warning icon** if a sync found that the work in that log no longer exists. Hover it (or focus it with the keyboard, or tap it on a phone) to see the date and reason.

In the Logs window, press **More info** on a log to see its files, commit, pull request and tokens.

Press **Logs** at the right end of the header to see every log in the project, newest first, with a search box for text, spec IDs and titles. Each log is a row: the time on the left, the spec, subtask and text on the right. Times up to 30 days old read as "time ago" ("3 hours ago"), older ones as a date and time; hover a time to see it exactly.

## Tokens

The board can show roughly how many tokens Claude used for each subtask, in the log and in the **Tokens** column of the table view. The Overview shows the total for the whole project, archived specs included.

- **Who counts them.** In a chat, a hook in the plugin runs when Claude writes a subtask log, and adds up what the session used since the previous log. A background run has hooks turned off, so the board counts it instead: it adds up the tokens in the run's output the same way and writes them into each log when the run ends. A chat in a project set up with plain `init`, without the plugin, gets no counts.
- **They are approximate.** The tokens spent between one log and the next go to the later subtask, so a subtask that comes after a long discussion looks more expensive than it was. Treat the numbers as a guide, not a bill.
- **Claude never writes them.** Claude can't see its own usage, so the plugin (in a chat) or the board (in the background) does the counting. An obsolete log keeps its tokens, because they were spent.
- **You can turn it off.** Choose **Settings** in the logo menu and switch off **Track tokens**. The column and the total then disappear too.

A background run also shows its total on the last line of its run panel, which ends with "· 48.2k tokens".

## Sync with code

Over time the board can drift from the code: work gets done without a tick, or a spec describes something that was removed. **Sync with code** brings it back in line.

- **Whole project:** choose **Sync with code** in the logo menu. **One spec:** press **Sync** in the card, beside **Run**. In a chat, type `/specboard:sync-specs` or `/specboard:sync-specs T-104`.
- **What it looks at:** the specs, their logs, the code and the git history. It proposes ticks (with the commit that shows the work), status moves, new draft specs for work that has no card, and specs to archive. It unticks only with clear evidence the work was removed. It never moves a spec to Done, and it never deletes a spec or a log.
- **Cards can move back.** If a Claude subtask has no work in the code and the card is in a column ahead of it, sync proposes moving the card back: to To-do when no Claude subtask is ticked, otherwise to Doing. A spec with only `(you)` steps never moves back.
- **Without git** sync still runs. It can't compare against the git history, and when you confirm, it skips any change that no longer fits the files and tells you.
- **You see it first.** From the board, Claude writes a proposal and changes nothing else. A dialog shows a warning, the list of changes and the tree. Choose **Confirm** to apply exactly that proposal, or **Cancel** to throw it away. If the code changed between the two steps, the apply stops, the run panel says **Sync stopped**, nothing is archived and the proposal is thrown away: sync again.
- **Specs to archive** are archived by the board once you confirm and Claude has applied every change. In a chat, sync names them and you archive them on the board.
- **Old logs stay.** When sync unticks a subtask or archives a spec, it marks the matching logs obsolete instead of deleting them.
- **If the browser closes** before you confirm, a **Sync proposal waiting** item in the logo menu brings the dialog back for a whole-project sync. For one spec, a **Sync proposal waiting** button beside **Sync** in that card does the same.
- **When Claude isn't connected** the dialog shows the command to copy: `/specboard:sync-specs`, or with a spec ID.

## When Claude stops

- **It needs a decision.** Claude adds a required question and stops. Answer it on the card, then start the spec again and it carries on.
- **An action was refused in the background.** The card shows what was refused and the rule that would allow it, if it's safe to offer. From a copy of the repo, run the `allow` command it gives you in a terminal, then run again. With the plugin there is no `specboard` in your terminal, so ask Claude to run `/specboard:setup` again to update the allowed commands, or to run `specboard init --yes --no-skills --runs yes "<project folder>"`. Refusals of the pull request lookup (`gh pr view`, `glab mr view`) and of `specboard tree` don't stop a run: Claude skips the link or the tree and carries on.
- **It's waiting on you.** The spec has a `(you)` step before more work, such as adding a file or a key. The run panel says **Waiting on you** and names the step. Do it, tick it on the card, then run again. This is a pause, not an error.
- **It finished.** The card moves to Review. Only you can move a card to Done.

A blocked spec or a draft can't be started from the card. If you start one from a chat anyway, Claude refuses and says why.

## The other Claude buttons on the board

These run in the background: **Have Claude write this up** on a draft, **Refresh** in the overview, **Ask Claude to fix** on a file with a formatting problem, **Sync with code**, and the automatic question refresh after you edit a spec (only when background runs are approved). To do them in your chat, type `/specboard:create-spec T-001`, `/specboard:refresh-overview`, `/specboard:update-spec T-001 fix the formatting` or `/specboard:sync-specs`. The question refresh is `/specboard:refresh-questions T-001`.
