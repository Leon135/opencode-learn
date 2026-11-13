/**
 * Shared path-input sanitizer for the TUI directory dialogs (md-link, viz):
 * trims, strips wrapping quotes, expands a leading `~` against the user's
 * home directory, then applies light sanity checks. Callers decide what an
 * empty value means and whether the path must exist.
 */

import { homedir } from "node:os"
import { join } from "node:path"

export type SanitizedDir =
  | { ok: true; value: string }
  | { ok: false; error: string }

export function sanitizeDirInput(raw: string): SanitizedDir {
  let d = String(raw ?? "")
    .trim()
    .replace(/^["']+|["']+$/g, "")
  if (d.includes("\0")) return { ok: false, error: "invalid path" }
  if (d.split("/").includes(".."))
    return { ok: false, error: "path may not contain '..'" }
  // Expansion happens after the ".." check: path.join would silently resolve
  // a "~/.." escape out of the home directory.
  if (d.startsWith("~")) d = join(homedir(), d.slice(1))
  if (d.length > 0 && !/^[A-Za-z0-9 ._\-\/]+$/.test(d))
    return { ok: false, error: `unsupported characters in "${d}"` }
  return { ok: true, value: d }
}
