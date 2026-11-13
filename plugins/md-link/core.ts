/**
 * md-link core — single source of truth for the Obsidian live-mirror pair.
 *
 * Consumers:
 *   plugins/md-link/index.ts (server: mirrors assistant replies)
 *   plugins/md-link/tui.ts   (TUI: ctrl+alt+m / /md-link toggle)
 *
 * The package's `.` entry (plugins/index.ts) registers the server part; the
 * TUI part loads through the package's `./tui` export (plugins/tui.ts).
 *
 * State file contract (~/.config/opencode/md-link-state.json):
 *   {
 *     "defaultDir": "/abs/dir" | null,          // fallback output dir
 *     "keep": 25 | null,                        // prune mirrors to N newest replies
 *     "sessions": { "<sessionID>": "/abs/dir" } // "" dir = use defaultDir
 *     "persist": true|false                     // true = mirrors survive TUI exit
 *   }
 *
 * With persist=true, TUI exit keeps this project's mirror files AND their
 * session entries, so the event subscription resumes mirroring into the same
 * files on the next launch. Explicit /md-link OFF always deletes regardless.
 *
 * Mirror file contract (<dir>/<sessionID>.md):
 *   Contains ONLY response blocks — no frontmatter, titles, or separators:
 *     <!-- msg:<assistantMessageID>#<ordinal> -->   (dedup marker, invisible
 *     **HH:MM**                                      in Obsidian preview)
 *
 *     <reply text>
 *
 * The server re-reads the state file on every event so TUI toggles apply
 * instantly. Writers are read-modify-write on tiny local files: interleaved
 * writes from server and TUI are possible and accepted at this scale.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync, appendFileSync } from "fs"
import { dirname, join } from "path"
import { homedir } from "os"

export const STATE_FILE = join(homedir(), ".config", "opencode", "md-link-state.json")

export type MdLinkState = {
  defaultDir: string | null
  keep: number | null
  sessions: Record<string, string>
  /** True = mirror files + session entries survive TUI exit (resume next launch). */
  persist?: boolean
}

const EMPTY_STATE: MdLinkState = { defaultDir: null, keep: null, sessions: {}, persist: false }

/** Read state, migrating legacy formats (plain array / {sessions:[...]}). */
export function loadState(): MdLinkState {
  try {
    if (!existsSync(STATE_FILE)) return { ...EMPTY_STATE, sessions: {} }
    const raw = JSON.parse(readFileSync(STATE_FILE, "utf-8"))

    if (Array.isArray(raw)) {
      const sessions: Record<string, string> = {}
      for (const x of raw) if (typeof x === "string") sessions[x] = ""
      return { ...EMPTY_STATE, sessions }
    }
    if (raw && typeof raw === "object") {
      const sessions: Record<string, string> = {}
      const s = (raw as any).sessions
      if (s && typeof s === "object" && !Array.isArray(s)) {
        for (const [k, v] of Object.entries(s)) {
          if (typeof k === "string" && k && typeof v === "string") sessions[k] = v
        }
      } else if (Array.isArray(s)) {
        for (const x of s) if (typeof x === "string") sessions[x] = ""
      }
      return {
        defaultDir: typeof raw.defaultDir === "string" ? raw.defaultDir : null,
        keep: typeof raw.keep === "number" && raw.keep >= 1 ? Math.floor(raw.keep) : null,
        sessions,
        persist: raw.persist === true,
      }
    }
  } catch {}
  return { ...EMPTY_STATE, sessions: {} }
}

/** Atomic-enough write for our scale (single writer per toggle, tiny file). */
export function saveState(st: MdLinkState): void {
  try {
    mkdirSync(dirname(STATE_FILE), { recursive: true })
    writeFileSync(STATE_FILE, JSON.stringify(st, null, 2), "utf-8")
  } catch {}
}

export function isEnabled(st: MdLinkState, sessionID: string): boolean {
  return sessionID in st.sessions
}

/** Remove a session (read-modify-write). */
export function disableSession(st: MdLinkState, sessionID: string): void {
  delete st.sessions[sessionID]
  saveState(st)
}

/** Resolve where a session's mirror lives. Falls back through recorded dir → defaultDir → fallbackDir. */
export function mirrorFile(st: MdLinkState, sessionID: string, fallbackDir?: string): string | null {
  let dir = st.sessions[sessionID] ?? ""
  if (!dir && st.defaultDir) dir = st.defaultDir
  if (!dir && fallbackDir) dir = fallbackDir
  if (!dir) return null
  return join(dir, `${sessionID}_link.md`)
}

/** Create an empty mirror file (responses only — zero boilerplate). No-op if it exists. */
export function touchMirror(file: string): void {
  if (existsSync(file)) return
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, "", "utf-8")
}

export type AppendResult = "written" | "updated" | "duplicate" | "failed"

/** Extract full reply text from a /message item (shapes vary: content[] parts or flat text). */
export function messageText(m: any): string {
  let text = ""
  if (Array.isArray(m?.content)) {
    text = m.content
      .filter((c: any) => c?.type === "text" && typeof c.text === "string")
      .map((c: any) => c.text)
      .join("\n")
  }
  if (!text && typeof m?.text === "string") text = m.text
  return text.trim()
}

/** Skill declarations are system-injected context, not learner prose. */
export function stripSkillBlocks(text: string): string {
  return text.replace(/<skill\b([^>]*)>[\s\S]*?<\/skill>/g, (_m, attrs: string) => {
    const name = /name="([^"]+)"/.exec(attrs)?.[1]
    return `[SKILL loaded: ${name ?? "(unknown)"}]`
  })
}

/** Obsidian callout block: `> [!type] title` + quoted body lines. */
export function callout(type: string, title: string, bodyLines: string[]): string {
  const lines = [`> [!${type}] ${title}`]
  for (const line of bodyLines) lines.push(line.length === 0 ? ">" : `> ${line}`)
  return lines.join("\n")
}

/** User-prompt block, identical for the live event path and history backfill. */
export function userPromptBlock(text: string): string {
  return callout("quote", "YOU", stripSkillBlocks(text.trim()).split("\n"))
}

/** True if the file contains a block whose marker starts with `<!-- msg:<key>` */
export function hasBlock(file: string, key: string): boolean {
  try {
    return readFileSync(file, "utf-8").includes(`<!-- msg:${key}`)
  } catch {
    return false
  }
}

/**
 * Live-event marker key for an assistant message part. Part 0 reuses the
 * mid-stream backfill block (see tui.ts backfillLatestTurn) when one exists,
 * so toggling the mirror ON while a reply is still streaming cannot leave
 * the same reply written twice.
 */
export function assistantKey(messageID: string, ordinal: number, file: string): string {
  return ordinal === 0 && hasBlock(file, `${messageID}#backfill`)
    ? `${messageID}#backfill`
    : `${messageID}#${ordinal}`
}

/**
 * Append one reply block, deduped/upserted by markerKey, then prune to `keep`.
 * With replace=true, an existing block for the same key is rewritten when its
 * text differs (used by the poller while replies are still streaming).
 * Block format (see module doc): marker comment, local HH:MM, blank line, text.
 */
export function appendMessage(
  file: string,
  opts: { text: string; markerKey: string; replace?: boolean },
  keep: number | null,
): AppendResult {
  const key = opts.markerKey
  try {
    if (hasBlock(file, key)) {
      if (!opts.replace) return "duplicate"
      return replaceBlock(file, key, opts.text) ? "updated" : "duplicate"
    }
    const time = clock()
    appendFileSync(file, `<!-- msg:${key} -->\n**${time}**\n\n${opts.text.trim()}\n\n`, "utf-8")
    pruneMirror(file, keep)
    return "written"
  } catch {
    return "failed"
  }
}

function clock(): string {
  return new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
}

/** Split a mirror file's content into its (usually empty) head and its reply blocks. */
function splitBlocks(content: string): { head: string; blocks: string[] } {
  const first = content.search(/<!-- msg:/)
  if (first === -1) return { head: content, blocks: [] }
  return {
    head: content.slice(0, first),
    blocks: content
      .slice(first)
      .split(/(?=<!-- msg:)/g)
      .filter((b) => b.trim().length > 0),
  }
}

/** Rewrite an existing block's text in place. Returns false if unchanged/not found. */
function replaceBlock(file: string, key: string, text: string): boolean {
  const { head, blocks } = splitBlocks(readFileSync(file, "utf-8"))
  const idx = blocks.findIndex((b) => b.startsWith(`<!-- msg:${key}`))
  if (idx === -1) return false
  const fresh = `<!-- msg:${key} -->\n**${clock()}**\n\n${text.trim()}\n\n`
  const norm = (s: string) => s.replace(/\s+/g, " ").trim()
  if (norm(blocks[idx]) === norm(fresh)) return false
  blocks[idx] = fresh
  writeFileSync(file, head + blocks.join(""), "utf-8")
  return true
}

/** Keep only the newest `keep` reply blocks. keep <= 0/null = unlimited. */
export function pruneMirror(file: string, keep: number | null): void {
  try {
    if (!keep || keep < 1) return
    const { head, blocks } = splitBlocks(readFileSync(file, "utf-8"))
    if (blocks.length <= keep) return
    writeFileSync(file, head + blocks.slice(-keep).join(""), "utf-8")
  } catch {}
}
