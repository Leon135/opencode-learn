/**
 * md-link — Obsidian live-mirror (server side).
 *
 * Mirrors a session to `<dir>/<sessionID>_link.md` for sessions enabled in
 * the state file (see core.ts for the contracts). Sessions are toggled
 * exclusively by the TUI plugin — this plugin never enables anything.
 *
 * Mirrors are transient by default — with persistence ON (/md-link-persist),
 * session entries survive TUI exit and this subscription resumes them on next launch.
 *
 * What gets mirrored (teaching-session parity with the pi md-log):
 *   - assistant replies   → ctx.event.subscribe session.text.delta (2.5 s
 *                           throttle while streaming) + session.text.ended
 *   - user prompts        → session.inbox.enqueued, as `> [!quote] YOU` callouts
 *   - quiz_ask / question → tool hooks: question callout written at
 *                           execute.before (pre-answer, sanitized input),
 *                           feedback callout at execute.after (quiz_grade /
 *                           question results)
 * The subscription is aborted by the cleanup returned from setup; an
 * unexpected stream exit is logged and re-armed (the old poller self-recovered).
 */

import type { Plugin } from "@opencode/plugin";
import {
  appendMessage,
  callout,
  hasBlock,
  isEnabled,
  loadState,
  mirrorFile,
  touchMirror,
  userPromptBlock,
} from "./core.ts";

/** Streaming cadence: rewrite an in-flight reply block at most this often. */
const DELTA_WRITE_MS = 2_500;
/** Wait before re-subscribing after the event stream exits unexpectedly. */
const RESUBSCRIBE_MS = 5_000;

/** Append one block, keeping the existing text when the key is already mirrored. */
function mirrorBlock(
  file: string,
  key: string,
  text: string,
  keep: number | null,
): void {
  if (!text || hasBlock(file, key)) return;
  appendMessage(file, { text, markerKey: key, replace: true }, keep);
}

/** Write an assistant block, rewriting the existing one in place while streaming. */
function writeAssistant(
  file: string,
  key: string,
  text: string,
  keep: number | null,
): void {
  if (!text) return;
  appendMessage(file, { text, markerKey: key, replace: true }, keep);
}

/** The subset of the session event stream this plugin mirrors. */
type MirrorEvent =
  | {
      type: "session.text.delta";
      data: {
        sessionID: string;
        assistantMessageID: string;
        ordinal: number;
        delta: string;
      };
    }
  | {
      type: "session.text.ended";
      data: {
        sessionID: string;
        assistantMessageID: string;
        ordinal: number;
        text: string;
      };
    }
  | {
      type: "session.inbox.enqueued";
      data: {
        sessionID: string;
        inboxID: string;
        item:
          | { type: "user"; payload: { text: string } }
          | { type: "synthetic" | "compaction" | "move" };
      };
    };

// ── Q&A callouts via tool hooks ─────────────────────────────────────────────

/** Resolve the mirror file for a session, or null if not enabled. */
function mirrorFor(sessionID: unknown): string | null {
  if (typeof sessionID !== "string" || !sessionID) return null;
  const st = loadState();
  if (!isEnabled(st, sessionID)) return null;
  return mirrorFile(st, sessionID, process.cwd());
}

function appendQa(
  file: string,
  markerKey: string,
  text: string,
  keep: number | null,
): void {
  const res = appendMessage(file, { text, markerKey, replace: true }, keep);
  // "duplicate" is the expected steady state on service restarts / re-reads.
  if (res === "failed") console.error("[md-link] qa append failed:", markerKey);
}

function questionCallout(
  label: string,
  question: string,
  details: string | undefined,
  options: any[],
  images: any[] = [],
): string {
  const body: string[] = [];
  for (const line of String(question || "").split("\n")) body.push(line);
  if (details) {
    body.push("");
    for (const line of details.split("\n")) body.push(line);
  }
  const imgs = images.map((i) => String(i).trim()).filter(Boolean);
  if (imgs.length > 0) {
    body.push("");
    for (const src of imgs) body.push(`![material](${src})`);
  }
  const opts = Array.isArray(options) ? options : [];
  if (opts.length > 0) {
    body.push("");
    opts.forEach((o, i) => body.push(`${i + 1}. ${o?.label ?? ""}`));
  }
  return callout("question", label, body);
}

function resultText(result: any): string {
  if (typeof result === "string") return result;
  if (typeof result?.content === "string") return result.content;
  if (Array.isArray(result?.content)) {
    return result.content
      .filter((c: any) => c?.type === "text")
      .map((c: any) => c.text)
      .join("\n");
  }
  return String(result?.output ?? "");
}

/** Feedback callout from quiz_grade's result text (we control that format). */
function gradeCallout(content: string): string {
  // Drop the render instruction line and the openui-lang program block.
  const cleaned = content
    .replace(/```openui-lang[\s\S]*?```/g, "")
    .split("\n")
    .filter(
      (l) =>
        l.trim().length > 0 &&
        !/^If you have the openchamber_render tool/i.test(l.trim()),
    );
  const first = cleaned[0] ?? "";
  if (/answered correctly/i.test(first)) {
    return callout("success", "Quiz — correct ✓", cleaned.slice(1));
  }
  if (/answered incorrectly/i.test(first)) {
    return callout("failure", "Quiz — incorrect ✗", cleaned.slice(1));
  }
  if (/selected "\.\.\.\?"/i.test(first)) {
    return callout("question", "Quiz — ...?", cleaned.slice(1));
  }
  if (/dismissed|not answered in time/i.test(content)) {
    return callout("warning", "Quiz — dismissed", ["(no answer given)"]);
  }
  return callout("example", "Quiz", cleaned);
}

export async function setupMdLink(ctx: Plugin.Context): Promise<() => void> {
  const controller = new AbortController();
  /** In-flight assistant text per `<messageID>#<ordinal>` and its last write time. */
  const inflight = new Map<string, { text: string; written: number }>();

  const handleEvent = (event: MirrorEvent): void => {
    try {
      const st = loadState();
      const sessionID = event.data.sessionID;
      if (!isEnabled(st, sessionID)) return;
      // Fallback chain: recorded dir → config defaultDir → cwd (no hardcoded paths).
      const file = mirrorFile(st, sessionID, process.cwd());
      if (!file) return;
      touchMirror(file);

      if (event.type === "session.inbox.enqueued") {
        const item = event.data.item;
        if (item.type !== "user") return;
        const text = String(item.payload.text ?? "").trim();
        if (text)
          mirrorBlock(
            file,
            `${event.data.inboxID}`,
            userPromptBlock(text),
            st.keep,
          );
        return;
      }

      const key = `${event.data.assistantMessageID}#${event.data.ordinal}`;
      if (event.type === "session.text.delta") {
        const entry = inflight.get(key) ?? { text: "", written: 0 };
        entry.text += event.data.delta;
        const now = Date.now();
        if (now - entry.written >= DELTA_WRITE_MS) {
          entry.written = now;
          writeAssistant(file, key, entry.text.trim(), st.keep);
        }
        inflight.set(key, entry);
        return;
      }

      // session.text.ended: final text for the part, written immediately.
      inflight.delete(key);
      writeAssistant(file, key, event.data.text.trim(), st.keep);
    } catch {} // one bad event must not stop the subscription
  };

  // Re-arm after an unexpected stream exit; the old poller recovered by itself.
  const subscribe = async (): Promise<void> => {
    while (!controller.signal.aborted) {
      try {
        for await (const event of ctx.event.subscribe({
          types: [
            "session.text.delta",
            "session.text.ended",
            "session.inbox.enqueued",
          ],
          signal: controller.signal,
        })) {
          handleEvent(event);
        }
        if (!controller.signal.aborted)
          console.error("[md-link] event stream ended — resubscribing");
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error(
          "[md-link] event subscription failed — resubscribing:",
          error,
        );
      }
      inflight.clear();
      if (controller.signal.aborted) return;
      await new Promise<void>((resolve) => {
        const done = () => {
          clearTimeout(timer);
          controller.signal.removeEventListener("abort", done);
          resolve();
        };
        const timer = setTimeout(done, RESUBSCRIBE_MS);
        controller.signal.addEventListener("abort", done, { once: true });
      });
    }
  };

  void subscribe();

  // ── Q&A capture ─────────────────────────────────────────────────────────
  // execute.before: write the question callout BEFORE the learner answers
  // (quiz_ask/question inputs are sanitized — no answer material).
  if (typeof ctx?.tool?.hook === "function") {
    await ctx.tool.hook("execute.before", async (event: any) => {
      try {
        const file = mirrorFor(event.sessionID);
        if (!file) return;
        const { keep } = loadState();
        if (event.tool === "quiz_ask") {
          const input = event.input ?? {};
          const block = questionCallout(
            "Quiz",
            input.question,
            input.details,
            input.options,
            input.images,
          );
          appendQa(file, `qa-ask-${event.id}`, block, keep);
        } else if (event.tool === "question") {
          const q = event.input?.questions?.[0] ?? {};
          const block = questionCallout(
            "Question",
            q.question ?? q.header ?? "",
            undefined,
            q.options,
          );
          appendQa(file, `qa-ask-${event.id}`, block, keep);
        }
      } catch {}
    });

    // execute.after: write the feedback callout (answer already given).
    await ctx.tool.hook("execute.after", async (event: any) => {
      try {
        const file = mirrorFor(event.sessionID);
        if (!file) return;
        const { keep } = loadState();
        if (event.tool === "quiz_grade") {
          const content = resultText(event.result);
          if (content)
            appendQa(file, `qa-grade-${event.id}`, gradeCallout(content), keep);
        } else if (event.tool === "question" && event.status === "completed") {
          const content = resultText(event.result);
          if (content)
            appendQa(
              file,
              `qa-grade-${event.id}`,
              callout("example", "Answer", content.split("\n")),
              keep,
            );
        }
      } catch {}
    });
  } else {
    console.error("[md-link] ctx.tool.hook unavailable — Q&A capture disabled");
  }

  return () => controller.abort();
}
