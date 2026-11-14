# Future Features

These are ideas for later versions. **They are not part of the MVP** described in [documentation.md](documentation.md).

- **Cloud version**
- **Slack / Telegram integration**
- **Git integration**
- **Co-working**
- **Setup presets.** `/plan-project` would ask whether you want Simple or Robust. Simple is what Spec Board does today. Robust would add more detailed questions, full acceptance criteria (scenarios), an out-of-scope list, approach and design notes, the files a spec touches, and size limits.
- **Design docs.** A place for a spec's design (images, Figma links, Markdown) that the board shows and runs read. A `(you)` "add the design" step would point at it.
- **Claude artifacts.** Link or embed Claude artifacts (mockups, prototypes, write-ups) in a spec, and let Claude publish one from a spec.
- **Exact token counts for chat work.** The plugin's hook already adds up the tokens a session used between one subtask log and the next, but that is an approximation: Claude in a chat can't see its own usage, so spend between two logs lands on the later subtask. Exact per-subtask numbers would need Claude Code to report usage per step.
- **Publish to npm.** Run `init` and the board from any folder with `npx`, with no copy of this repo and no plugin.
- **Live mirroring of chat activity.** Show what Claude is doing in a chat on the board as it happens, not only through the files it writes.
- **Obsidian vault tips.** Not built, and not planned as an integration. The specs are plain Markdown with YAML front matter, so you can already open `.specboard/` as an Obsidian vault and use its search and graph on your specs. Open the vault on `.specboard/`, not on the whole project, so that only specs, logs and the overview show up. Edit through the board or Claude when you can, and if you edit in Obsidian, keep the front matter lines (`id`, `status` and the rest) as they are, because the board reads them. A deeper integration, such as wikilinks for dependencies or an Obsidian plugin, would add a second way to edit the same files for little gain.
