# Running a spec

There are two ways to have Claude work on a spec, and the card shows both as equal buttons: **Copy run command** and **Run in background**. **Use your chat unless you have a reason not to.** Use the background when you don't fully trust the repo, or don't want to sit with a chat.

| | In your Claude chat | In the background |
|---|---|---|
| **How to start** | Press **Copy run command** on the card and paste it into a chat, or type `/run-spec T-001` | Press **Run in background** on the card |
| **Where you watch it** | In the chat, in full | On the card, as a short list of steps |
| **When Claude needs an action approved** | It asks you in the chat | It can't ask. Anything you haven't approved is refused and the run stops |
| **Your Claude settings, plugins and MCP servers** | Apply as usual | Off |
| **The project's hooks, MCP servers and settings** | Apply as usual | Off |
| **To stop it** | Press Esc in the chat | Press **Stop** on the card |
| **Setup it needs** | `init` copied the commands, the chat is open in the project folder, and you trusted that folder when Claude asked | `init` approved the list of actions |

## Why the chat is the usual choice

You see all of Claude's work in the place you already work, and you can step in, answer or redirect it there. The board can't type into a chat that's already open, so **Copy run command** copies `/run-spec T-001` for you to paste.

Your chat is the less restricted of the two. A project's hooks and MCP servers run there, as they do in any Claude Code session in that folder. If you don't trust a repo, that's the difference that matters, and it's the reason the background run stays.

## Why the background run stays

It's already isolated from the repo's Claude settings, so a repo can't add hooks to it or widen what it may do. It also runs without tying up a chat. [Safety](safety.md) has the limits: the project's tests and git hooks still run with your rights.

## What the board shows during a chat run

The board follows the files. While Claude works in your chat, the card moves to Doing, shows the current subtask, ticks subtasks off and shows their logs and commits, then moves to Review.

It doesn't show Claude's messages or the commands it runs. Those stay in the chat, and the **Run output** panel only appears for background runs.

## When Claude stops

- **It needs a decision.** Claude adds a required question and stops. Answer it on the card, then start the spec again and it carries on.
- **An action was refused in the background.** The card shows what was refused and the rule that would allow it, if it's safe to offer. Run the `allow` command it gives you in a terminal, then run again.
- **It finished.** The card moves to Review. Only you can move a card to Done.

A blocked spec or a draft can't be started from the card. If you start one from a chat anyway, Claude refuses and says why.

## The other Claude buttons on the board

These always run in the background: **Have Claude write this up** on a draft, **Refresh** in the overview, and **Ask Claude to fix** on a file with a formatting problem. To do them in your chat, type `/create-spec T-001`, `/refresh-overview` or `/update-spec T-001 fix the formatting`.
