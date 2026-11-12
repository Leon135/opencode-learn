# opencode-learn

An AI teaching system packaged as an [OpenCode v2](https://opencode.ai/v2/docs/) plugin. The `teach` skill probes what you already know, plans a dependency map, then teaches node by node — checking each node lands with a graded quiz before building on top of it.

## Where it comes from

Three generations of the same system:

1. **[amosblomqvist/learn](https://github.com/amosblomqvist/learn)** — the original, built as [pi](https://github.com/earendil-works/pi) configuration. The teaching philosophy, the skills and the system design are all his, from the video [How I Use AI to Learn Things](https://www.youtube.com/watch?v=kzcI5F4tGiU).
2. **[FAZuH/oc-learn](https://github.com/FAZuH/oc-learn)** — a port of that system to OpenCode.
3. **This repository** — takes FAZuH's port and brings it up to date with the current OpenCode v2 plugin API, adds [OpenChamber](https://github.com/openchamber/openchamber) support, and adds a simple cross-session memory.

> [!WARNING]
> Experimental — some things may not work or may break.

## Install

Requires OpenCode v2.

```jsonc
{
  "plugins": ["@leon135/opencode-learn"],
}
```

Visuals publish into the session project's `viz/` by default — the project dir is captured once when the plugin sets up (`ctx.location.directory`), so publishes resolve against it even if the process cwd differs. To always publish somewhere else (an Obsidian vault, say), run `/viz-dir` in the TUI — or point `~/.config/opencode/viz-state.json` at it directly; the override still wins, and empty or missing means the project dir:

```json
{ "defaultDir": "/home/you/Notes/viz" }
```

md-link keeps its own state next to it in `~/.config/opencode/md-link-state.json` (`defaultDir`, `keep`, `persist`, and the enabled sessions).

## Memory

Teaching spans sessions; session context does not. The `teach` skill keeps **project-scoped learner profiles** under `.memory/` — read at session start and updated as the session goes rather than in one dump at the end:

- **`.memory/profile.md` — the general profile**
  - **How to explain to you** — which analogies and cadence work, and which don't
  - **Cross-subject struggles** — struggles and mistake patterns that recur across subjects
- **`.memory/subjects/<topic>.md` — one file per subject** (e.g. `subjects/math.md`)
  - **Known foundations** — what you reliably hold, and where your edge is
  - **Struggles** — concepts and moves that cost visible effort
  - **Typical mistakes** — recurring slips, phrased specifically enough to quote back
  - **Practice queue** — what to drill next and why
  - **Active plan / where we left off** — the current plan, stuck point, next-session hook

## Quiz modes

**Chat-UI mode** returns the question plus a ready `openui-lang` program for `openchamber_render`; [OpenChamber](https://github.com/openchamber/openchamber) renders it, returns the chosen letter(s) and any note, and the model relays them to `quiz_grade(selected, note)`. The question, its details and the lettered option texts all render inside the callout (markdown, so LaTeX works there), while the Choice buttons stay plain letters (A, B, C…); a letter resolves to the shuffled option value through the same letter/value logic as before. Without that tool the result includes a plain-text lettered fallback.

**Form mode** (TUI, and `auto` when chat detection fails) is a hybrid: the session form carries only lettered options (A, B, C…, plus "...?") and a note field, with the fixed title "Quiz — answer the question shown in chat". The full question, its details and the lettered option texts come back in the `quiz_ask` result, which tells the model to post that block as a chat message (markdown; math renders per the TUI's own pipeline). The form opens before that message can appear, so you may see the lettered form first — an accepted ordering wrinkle of the design. Form grading uses the same letter/value resolution as chat.

**Images.** `quiz_ask` accepts an optional `images` array (local file paths — prefer paths relative to the session's directory; absolute paths outside the workspace may fail to load in chat) for questions that refer to a diagram, figure or screenshot. Because the quiz callout cannot load local images (an OpenChamber renderer limitation), the chat-mode result returns **two ordered blocks**: a plain-chat-message markdown block with the image embeds (post it first, adding nothing) and the `openui-lang` program right after, so the user sees image then question back-to-back. Form mode embeds the images into the posted question block, and the Obsidian mirror carries them in the Q&A callout.

The plugin option `mode` is `"auto"` (default), `"chat"`, or `"form"`:

```jsonc
{
  "plugins": [
    {
      "package": "@leon135/opencode-learn",
      "options": { "mode": "auto" },
    },
  ],
}
```

`auto` detects `openchamber_render` in the session's tool catalog (memoized per session): present → chat, absent → form. If detection fails or has not run yet, it degrades to chat — a plain-text question still works there, while an invisible form does not.

No synchronous HTML/KaTeX transport ships: a plugin-POSTed page is never displayed (the chat draws only `openchamber_render` tool-call pages) and an inlined-KaTeX page exceeds OpenChamber's `render.html` 200 000-character page cap.

## Requirements

- [OpenCode v2](https://opencode.ai/v2/docs)
- `rsvg-convert` (librsvg) or ImageMagick — SVG rendering
- `mmdc` (`@mermaid-js/mermaid-cli`) on PATH — Mermaid rendering
- [Bun](https://bun.sh) only for development: `bun install`, then `bun x tsc --noEmit` to typecheck
- Subagents inherit the session's model — edit `plugins/agents.ts` to tune them
- For quizzes: nothing extra — chat-UI mode auto-detects `openchamber_render` (OpenChamber) and otherwise uses OpenCode v2's native TUI forms. See [Quiz modes](#quiz-modes) to force one.

## Notes

- The teaching flow: `teach` probes your level with graded quizzes (`quiz_ask`/`quiz_grade`), plans a dependency map, then teaches node by node with a quiz check after each one. Non-graded questions use OpenCode's built-in `question` tool.
- Visuals are never hand-faked: the skill briefs a maker subagent, which authors, renders to PNG, **looks at the result**, iterates, and only then publishes into `viz/` for embedding.
- `md-link` mirrors only reading-relevant content: your prompts, lesson prose, and quiz Q&A. Tool noise (bash, reads, edits) is omitted. It is event-driven: assistant text is rewritten in place at most every 2.5 s while streaming, the final reply is written when the stream ends, and user prompts are mirrored as they are enqueued. Commands: `ctrl+alt:m` or `/md-link [dir]` toggles the focused session (ON backfills the last 10 messages — replies and your prompts), `/md-link-dir` sets the default output directory, `/md-link-keep` keeps only the N newest replies, and `/md-link-persist [on|off]` keeps mirrors across TUI restarts and auto-resumes them on next launch. `/md-link` OFF still deletes immediately.
- The maker and researcher agents are registered with deny-all permissions plus only the few actions they need. Under v2's last-match-wins permission rule, a later permissive global permission can widen that sandbox; the plugin cannot pin it, so keep global `allow` rules narrow if you rely on it.
- The makers render but the tools return a path, not an image — `render_*` returns the PNG path and the maker opens it with `read` to inspect. Same verify-by-looking loop, one extra step.
- You can run the system without subagents: the main session does the teaching. You lose the researcher (truth verification) and the generated visuals.

## Differences from the original

Carried over from the OpenCode port (FAZuH's work, relative to the pi original):

- **Configurable viz output** — `viz-state.json` (`defaultDir`) sends published visuals to any directory; the original always wrote to `<cwd>/viz`.
- **md-link TUI commands** — `ctrl+alt:m` / `/md-link` with per-session enable, plus `/md-link-dir`, `/md-link-keep`, and `/md-link-persist`; the original had `/md-log` / `/md-unlog` commands only.
- **quiz is two tools** — `quiz_ask` poses the question, `quiz_grade` carries the answer. The TUI shows raw tool arguments, so splitting at the answer boundary makes the correct answer structurally invisible until after you answer (the original hid it inside the popup renderer).
- **No `ask-user-question` extension** — OpenCode v2's built-in `question` tool covers non-graded questions.
- **No subagent extension** — v2's built-in `subagent` tool replaces `pi-interactive-subagents` (the original's recommended tmux-only dependency).
- **Render-and-inspect via path** — `render_*` returns the PNG path and the maker opens it with `read` (the original returned the image inline).
- **Linux-first rendering** — `mmdc` / `rsvg-convert` from PATH instead of a bundled mermaid-cli and macOS Chrome paths.

New in this repository:

- **Current OpenCode v2 plugin API** — brought up to date with the current `@opencode/plugin` surface: one package entry carrying both the server and TUI parts (replacing FAZuH's symlinking `install.sh`/`uninstall.sh`), session event subscription instead of message polling, and the plugin client instead of spawning `opencode2`. Agents and skills are registered by the plugin itself.
- **OpenChamber support** — [OpenChamber](https://github.com/openchamber/openchamber)-aware quiz transport: chat-UI mode auto-detects `openchamber_render` and renders the question as an interactive callout with lettered buttons.
- **Simple memory** — project-scoped learner profiles under `.memory/`: a general profile plus one file per subject, so the teacher picks up where it left off across sessions. See [Memory](#memory).

## Credits

- **[amosblomqvist](https://github.com/amosblomqvist)** — original system, teaching philosophy, and the video: [amosblomqvist/learn](https://github.com/amosblomqvist/learn) (pi configuration)
- **[FAZuH](https://github.com/FAZuH)** — the OpenCode port: [FAZuH/oc-learn](https://github.com/FAZuH/oc-learn)
- This repository — fork of that port, updated for the current OpenCode v2, with OpenChamber support and the learner profile added
