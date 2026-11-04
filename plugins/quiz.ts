/**
 * learn-quiz — GRADED question pair for the teaching system (v2 port of the
 * pi quiz extension's server side).
 *
 * Two tools, because the v2 TUI displays raw tool-call arguments to the user
 * while a tool runs. Splitting at the answer boundary keeps the correct answer
 * invisible until AFTER the user has answered (pi's exact information flow):
 *
 *   quiz_ask   — pose the question. Input carries ONLY question/options/etc.
 *                Creates a session form (forms API), waits for the answer,
 *                stashes the raw selection per-session, returns it ungraded.
 *   quiz_grade — called after quiz_ask. Carries correctAnswer + explanation
 *                (safe to show now — the user already answered). Grades the
 *                stashed selection (exact-set match; "...?" is its own
 *                outcome) and returns the verdict + explanation.
 *
 * Transport, as shipped:
 *   chat / auto (openchamber_render detected): quiz_ask returns a ready
 *     openui-lang program; the model renders it with openchamber_render
 *     (awaitAnswer) and relays the chosen letter(s) + any note to
 *     quiz_grade (selected, note).
 *   form / TUI (auto with no render tool): quiz_ask opens a slim session form
 *     — lettered options + a note field, no question text — and returns the
 *     full question block for the model to post in the chat.
 *
 * The server plugin context exposes no form API, so forms go through the
 * official OpenCode client (`OpenCode.make` + `Service.discover`):
 *   POST   /api/session/:sid/form           {title, fields:[{key,type,title,description,options}]}
 *   GET    /api/session/:sid/form/:fid      -> {state: {status: pending|answered|cancelled, answer?}}
 *   POST   /api/session/:sid/form/:fid/reply {answer: {key: value}}
 *   DELETE /api/session/:sid/form/:fid      (cancel)
 */

import { OpenCode } from "@opencode/client";
import { Service } from "@opencode/client/service";
import type {
  FormState,
  OpenCodeClient,
  SessionFormCreateInput,
} from "@opencode/client";
import type { Plugin } from "@opencode/plugin";

const DONT_KNOW = "__dont_know__";
const POLL_MS = 400;
const TIMEOUT_MS = 10 * 60_000;
const CHAT_UI_TOOL = "openchamber_render";

type QuizMode = "auto" | "chat" | "form";

type QuizOption = {
  label: string;
  value: string;
  description?: string;
};

/** Per-session pending quiz state between quiz_ask and quiz_grade. */
type PendingQuiz = {
  question: string;
  details?: string;
  /** Form pendings carry the selection shape; chat pendings carry "chat". */
  mode: "single-select" | "multi-select" | "chat";
  /** Display order (post-shuffle), 1-based. */
  options: QuizOption[];
  status: "asked" | "answered" | "cancelled" | "timeout";
  selectedIndices: number[];
  dontKnow: boolean;
  note?: string;
};

const pendingKey = (sessionID: string) => `quiz:pending:${sessionID}`;

type StorageJson = Parameters<Plugin.Context["storage"]["set"]>[1];

function normalizeOptions(raw: any): QuizOption[] {
  const seen = new Set<string>();
  const out: QuizOption[] = [];
  for (const o of Array.isArray(raw) ? raw : []) {
    const label = String(o?.label ?? "").trim();
    if (!label) continue;
    const value = String(o?.value ?? "").trim() || label;
    if (seen.has(value)) throw new Error(`duplicate option value "${value}"`);
    seen.add(value);
    const description = String(o?.description ?? "").trim() || undefined;
    out.push({ label, value, description });
  }
  return out;
}

function shuffleOptions(options: QuizOption[]): QuizOption[] {
  const out = [...options];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Multi-select correctAnswer sometimes arrives JSON-stringified; coerce. */
function coerceCorrectAnswer(correctAnswer: unknown): string[] {
  if (Array.isArray(correctAnswer)) return correctAnswer.map((v) => String(v));
  const s = String(correctAnswer ?? "").trim();
  if (s.startsWith("[") && s.endsWith("]")) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v));
    } catch {}
  }
  return s ? [s] : [];
}

function optionRef(options: QuizOption[], index: number): string {
  const opt = options[index - 1];
  return `${letterFor(index - 1)}. ${opt ? opt.label : "(unknown)"}`;
}

function readMode(ctx: Plugin.Context): QuizMode {
  const raw = String(ctx.options?.mode ?? "auto")
    .trim()
    .toLowerCase();
  return raw === "chat" || raw === "form" ? raw : "auto";
}

/** A, B, …, Z, AA, AB, … */
function letterFor(index: number): string {
  let n = index;
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

function lettersToIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) {
    if (ch < "A" || ch > "Z") return -1;
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

function buildQuestionBlock(
  question: string,
  details: string | undefined,
): string {
  return details ? `**Q.** ${question}\n\n${details}` : `**Q.** ${question}`;
}

/** The lettered option texts, shared by the chat callout and the form-mode question message. */
function buildOptionList(options: QuizOption[]): string {
  return options.map((o, i) => `- **${letterFor(i)}.** ${o.label}`).join("\n");
}

function buildQuizProgram(
  question: string,
  details: string | undefined,
  options: QuizOption[],
  multiSelect: boolean,
): string {
  // Option texts live in the callout (markdown renders LaTeX there); the buttons are letters.
  const text = [
    question,
    ...(details ? [details] : []),
    buildOptionList(options),
  ].join("\n\n");
  const choices = options.map((_, i) => letterFor(i));
  choices.push("...?");
  const choiceArgs = multiSelect
    ? `${JSON.stringify(choices)}, "", true`
    : JSON.stringify(choices);
  return [
    `note = Callout(${JSON.stringify(text)}, "info", "Quiz")`,
    `choice = Choice("quiz-answer", ${choiceArgs})`,
    "root = Stack([note, choice])",
  ].join("\n");
}

function buildChatAskText(
  question: string,
  details: string | undefined,
  options: QuizOption[],
  multiSelect: boolean,
): string {
  const questionBlock = buildQuestionBlock(question, details);
  const fallback = options
    .map((o, i) => `${letterFor(i)}. ${o.label}`)
    .join("\n");
  const how = multiSelect
    ? "Reply with the letters or values of every correct option (for example: A, C)."
    : "Reply with the letter or value of your answer (for example: A).";
  return [
    questionBlock,
    "",
    "Render with the openchamber_render tool (pass awaitAnswer) if you have it; otherwise present the plain-text question below to the user.",
    "",
    "```openui-lang",
    buildQuizProgram(question, details, options, multiSelect),
    "```",
    "",
    "Plain-text fallback:",
    fallback,
    "...?",
    "",
    `${how} Then call quiz_grade with selected set to the user's answer.`,
  ].join("\n");
}

/** Chat mode: resolve the relayed answer against the shuffled options (values, labels or letters). */
function resolveSelected(
  pq: PendingQuiz,
  raw: unknown,
): { indices: number[]; dontKnow: boolean } | { error: string } {
  const values = coerceCorrectAnswer(raw);
  if (values.length === 0) {
    return {
      error:
        "selected is required in chat mode — pass the option value(s) or label(s) the user chose.",
    };
  }

  const indices: number[] = [];
  let dontKnow = false;
  for (const value of values) {
    const text = value.trim();
    if (!text) continue;
    const normalized = text.toLowerCase().replace(/[’']/g, "'");
    if (
      text === DONT_KNOW ||
      normalized === "...?" ||
      normalized === "i dont know"
    ) {
      dontKnow = true;
      continue;
    }

    const exactValue = pq.options.findIndex((o) => o.value === text);
    if (exactValue >= 0) {
      indices.push(exactValue + 1);
      continue;
    }
    const exactLabel = pq.options.findIndex((o) => o.label === text);
    if (exactLabel >= 0) {
      indices.push(exactLabel + 1);
      continue;
    }
    const lower = text.toLowerCase();
    const looseLabel = pq.options.findIndex(
      (o) => o.label.toLowerCase() === lower,
    );
    if (looseLabel >= 0) {
      indices.push(looseLabel + 1);
      continue;
    }

    const letterRun = /^([A-Za-z]+)(.*)$/s.exec(text);
    if (letterRun) {
      const byLetter = lettersToIndex(letterRun[1]);
      if (byLetter >= 0 && byLetter < pq.options.length) {
        const rest = letterRun[2];
        if (rest === "") {
          indices.push(byLetter + 1);
          continue;
        }
        // Only a label we generated ("B. <label>") may follow the letter. Anything else
        // (e.g. a space-separated letter list like "B C") is an honest unknown, never a prefix pick.
        const separator = /^\s*([.):-])\s*/.exec(rest);
        if (separator) {
          const remainder = rest.slice(separator[0].length).trim();
          if (
            remainder === "" ||
            remainder.toLowerCase() === pq.options[byLetter].label.toLowerCase()
          ) {
            indices.push(byLetter + 1);
            continue;
          }
        }
      }
    }

    const known = pq.options.map((o) => `"${o.value}"`).join(", ");
    return {
      error: `selected "${value}" does not match any quiz option value or label (${known})`,
    };
  }

  const unique = [...new Set(indices)].sort((a, b) => a - b);
  if (!dontKnow && unique.length === 0) {
    return {
      error:
        "selected is required in chat mode — pass the option value(s) or label(s) the user chose.",
    };
  }
  return { indices: unique, dontKnow };
}

export async function setupQuiz(ctx: Plugin.Context): Promise<void> {
  let client: OpenCodeClient | undefined;
  const forms = async () =>
    client ??
    (client = await (async () => {
      const endpoint = await Service.discover();
      if (!endpoint)
        throw new Error("could not discover the running OpenCode server");
      return OpenCode.make({
        baseUrl: endpoint.url,
        headers: Service.headers(endpoint),
      });
    })());
  const storePending = (sessionID: string, value: PendingQuiz) =>
    ctx.storage.set(pendingKey(sessionID), value as unknown as StorageJson);

  const mode = readMode(ctx);
  const chatUITools = new Map<string, boolean>();
  try {
    if (typeof ctx.session?.hook === "function") {
      await ctx.session.hook("context", (event) => {
        try {
          if (
            !event?.sessionID ||
            !event.tools ||
            typeof event.tools !== "object"
          )
            return;
          chatUITools.set(
            event.sessionID,
            Object.prototype.hasOwnProperty.call(event.tools, CHAT_UI_TOOL),
          );
        } catch {}
      });
    }
  } catch {}
  // Unknown (no context observed yet) degrades to chat, like any detection error.
  const hasChatUI = async (sessionID: string): Promise<boolean> =>
    chatUITools.get(sessionID) ?? true;

  await ctx.tool.transform((tools) => {
    // ── quiz_ask ──────────────────────────────────────────────────────────
    tools.add({
      name: "quiz_ask",
      description:
        "Pose ONE graded quiz question to the user and wait for their answer. Options-only (single-select or " +
        "multi-select); an '...?' choice is added automatically, plus an optional free-text note " +
        "(chat: relay it back via quiz_grade's `note`; TUI form: the form's own note field). " +
        "Returns the user's raw selection UNGRADED — always follow with quiz_grade (correctAnswer + explanation) " +
        "to reveal the verdict. For non-graded questions use the built-in question tool instead.",
      input: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description:
              "The single quiz question to ask. Ask exactly one question per tool call.",
          },
          details: {
            type: "string",
            description:
              "Optional extra context or instructions shown under the question.",
          },
          options: {
            type: "array",
            minItems: 2,
            items: {
              type: "object",
              properties: {
                label: {
                  type: "string",
                  description: "Display label for the answer option.",
                },
                value: {
                  type: "string",
                  description:
                    "Stable machine-readable value; defaults to the label. quiz_grade references this.",
                },
                description: {
                  type: "string",
                  description: "Optional extra detail shown below the option.",
                },
              },
              required: ["label"],
              additionalProperties: false,
            },
            description:
              "The answer options (2 or more). Give each a stable `value`. Never add your own '...?' option — it is added automatically.",
          },
          multiSelect: {
            type: "boolean",
            description:
              "Set to true when more than one option is correct and the user must select all of them.",
          },
          shuffle: {
            type: "boolean",
            description:
              "Default true: options are reordered before display. Set false only when order is meaningful.",
          },
        },
        required: ["question", "options"],
        additionalProperties: false,
      },
      execute: async (input: any, tctx: any) => {
        try {
          const question = String(input.question ?? "").trim();
          const details = String(input.details ?? "").trim() || undefined;
          const multiSelect = input.multiSelect === true;
          const sessionID =
            typeof tctx?.sessionID === "string" ? tctx.sessionID : "";

          if (!question)
            return { content: "quiz_ask failed: `question` is required." };
          if (!sessionID)
            return {
              content:
                "quiz_ask failed: no session context (sessionID missing).",
            };

          let options: QuizOption[];
          try {
            options = normalizeOptions(input.options);
          } catch (e) {
            return { content: `quiz_ask failed: ${(e as Error).message}` };
          }
          if (options.length < 2)
            return {
              content: "quiz_ask failed: at least two options are required.",
            };

          if (input.shuffle !== false) options = shuffleOptions(options);

          if (
            mode === "chat" ||
            (mode === "auto" && (await hasChatUI(sessionID)))
          ) {
            await storePending(sessionID, {
              question,
              details,
              mode: "chat",
              options,
              status: "asked",
              selectedIndices: [],
              dontKnow: false,
            });
            return {
              content: buildChatAskText(
                question,
                details,
                options,
                multiSelect,
              ),
            };
          }

          // Slim form: letters only — the question text is posted to the chat from the ask result.
          const displayOptions = options.map((_, i) => ({
            label: letterFor(i),
            value: letterFor(i),
          }));
          displayOptions.push({ label: "...?", value: DONT_KNOW });

          const answerField: SessionFormCreateInput["fields"][number] =
            multiSelect
              ? {
                  key: "answer",
                  type: "multiselect",
                  title: "Answer",
                  options: displayOptions,
                }
              : {
                  key: "answer",
                  type: "string",
                  title: "Answer",
                  options: displayOptions,
                };

          const created = await (
            await forms()
          ).session.form.create({
            sessionID,
            title: "Quiz — answer the question shown in chat",
            fields: [
              answerField,
              { key: "note", type: "string", title: "Note (optional)" },
            ],
          });
          const formID = created.id;
          if (!formID)
            return {
              content: `quiz_ask failed: could not create the question form (${JSON.stringify(created).slice(0, 200)})`,
            };

          const deadline = Date.now() + TIMEOUT_MS;
          let state: FormState | undefined;
          while (Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, POLL_MS));
            try {
              state = (
                await (await forms()).session.form.get({ sessionID, formID })
              ).state;
            } catch {}
            if (state && state.status !== "pending") break;
          }

          if (!state || state.status === "pending") {
            await (await forms()).session.form
              .cancel({ sessionID, formID })
              .catch(() => {});
            await storePending(sessionID, {
              question,
              details,
              mode: multiSelect ? "multi-select" : "single-select",
              options,
              status: "timeout",
              selectedIndices: [],
              dontKnow: false,
            });
            return {
              content:
                "User did not answer the quiz in time. Call quiz_grade to close it out (or move on).",
            };
          }
          if (state.status === "cancelled") {
            await storePending(sessionID, {
              question,
              details,
              mode: multiSelect ? "multi-select" : "single-select",
              options,
              status: "cancelled",
              selectedIndices: [],
              dontKnow: false,
            });
            return {
              content:
                "User dismissed the quiz without answering. Call quiz_grade to close it out (or move on).",
            };
          }

          // Answered: the form's letters resolve through the same helper chat mode uses.
          const resolved = resolveSelected(
            {
              question,
              details,
              mode: multiSelect ? "multi-select" : "single-select",
              options,
              status: "asked",
              selectedIndices: [],
              dontKnow: false,
            },
            state.answer.answer,
          );
          // The form only offers these letters; anything else counts as no valid selection.
          const selectedIndices = "error" in resolved ? [] : resolved.indices;
          const dontKnow = "error" in resolved ? false : resolved.dontKnow;
          const note = String(state.answer?.note ?? "").trim() || undefined;

          await storePending(sessionID, {
            question,
            details,
            mode: multiSelect ? "multi-select" : "single-select",
            options,
            status: "answered",
            selectedIndices,
            dontKnow,
            note,
          });

          let text = [
            buildQuestionBlock(question, details),
            buildOptionList(options),
            "The form shows letters only — post the question block above to the chat now so the user can read it.",
            "",
          ].join("\n\n");
          if (dontKnow) {
            text +=
              'User selected "I don\'t know" — they did not attempt an answer.';
          } else {
            text += `User selected: ${selectedIndices.map((i) => optionRef(options, i)).join(", ") || "(nothing)"}`;
          }
          if (note) text += `\nUser's note: ${note}`;
          text +=
            "\nNow call quiz_grade with correctAnswer (the option value(s) you intended) and explanation to reveal the verdict.";
          return { content: text };
        } catch (error) {
          return {
            content: `❌ quiz_ask failed: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    });

    // ── quiz_grade ─────────────────────────────────────────────────────────
    tools.add({
      name: "quiz_grade",
      description:
        "Grade the quiz the user just answered via quiz_ask. REQUIRED afterwards: pass correctAnswer (the option " +
        "value(s) you intended — single string or array for multi-select, exact-set match) and explanation (why the " +
        "correct answer is correct — always required). In chat mode also relay the user's answer as `selected` and " +
        "any note as `note`; in form mode both come from the form. Returns right/wrong, the correct answer, the " +
        "user's note, and your explanation; relay all of it to the user. '...?' grades as its own outcome, " +
        "never as wrong.",
      input: {
        type: "object",
        properties: {
          correctAnswer: {
            description:
              'REQUIRED. The correct answer as option value(s) from quiz_ask\'s options. Single-select: one string ("mercury"). Multi-select: array (["belize","niue"]) — exact-set match. Always the value, never a position number.',
            oneOf: [
              { type: "string" },
              { type: "array", items: { type: "string" } },
            ],
          },
          selected: {
            description:
              "Chat-UI mode only: the user's relayed answer — the option value(s) or label(s) they chose. Single string, or an array for multi-select. Required in chat mode; ignored in form mode.",
            oneOf: [
              { type: "string" },
              { type: "array", items: { type: "string" } },
            ],
          },
          note: {
            type: "string",
            description:
              "Chat-UI mode only: the user's free-text note, relayed verbatim from the ask callout. Ignored in form mode — the form has its own note field.",
          },
          explanation: {
            type: "string",
            description:
              "REQUIRED. Why the correct answer is correct — shown to the user after answering.",
          },
        },
        required: ["correctAnswer", "explanation"],
        additionalProperties: false,
      },
      execute: async (input: any, tctx: any) => {
        try {
          const sessionID =
            typeof tctx?.sessionID === "string" ? tctx.sessionID : "";
          const explanation = String(input.explanation ?? "").trim();
          const pq = sessionID
            ? ((await ctx.storage.get(pendingKey(sessionID))) as
                | PendingQuiz
                | undefined)
            : undefined;
          if (!pq)
            return {
              content:
                "quiz_grade failed: no pending quiz — call quiz_ask first.",
            };

          await ctx.storage.remove(pendingKey(sessionID));

          let selectedIndices: number[];
          let dontKnow: boolean;
          let note: string | undefined;
          if (pq.mode === "chat") {
            const resolved = resolveSelected(pq, input.selected);
            if ("error" in resolved)
              return { content: `quiz_grade failed: ${resolved.error}` };
            selectedIndices = resolved.indices;
            dontKnow = resolved.dontKnow;
            note = String(input.note ?? "").trim() || pq.note;
          } else {
            if (pq.status !== "answered") {
              return {
                content: `Quiz was ${pq.status === "cancelled" ? "dismissed by the user" : "not answered in time"} — no grade. Correct answer for your reference: ask again later if needed.`,
              };
            }
            selectedIndices = pq.selectedIndices;
            dontKnow = pq.dontKnow;
            note = pq.note;
          }

          // Resolve correctAnswer against the DISPLAY order stashed by quiz_ask.
          const arr = coerceCorrectAnswer(input.correctAnswer);
          if (arr.length === 0)
            return { content: "quiz_grade failed: correctAnswer is required." };
          const byValue = new Map(pq.options.map((o, i) => [o.value, i + 1]));
          const correctIndices: number[] = [];
          for (const raw of arr) {
            const idx = byValue.get(String(raw).trim());
            if (idx === undefined) {
              const known = pq.options.map((o) => `"${o.value}"`).join(", ");
              return {
                content: `quiz_grade failed: correctAnswer "${raw}" does not match any quiz_ask option value (${known})`,
              };
            }
            correctIndices.push(idx);
          }
          const uniqCorrect = Array.from(new Set(correctIndices)).sort(
            (a, b) => a - b,
          );

          const correct =
            !dontKnow &&
            selectedIndices.length === uniqCorrect.length &&
            selectedIndices.every((v, i) => v === uniqCorrect[i]);

          const selectedStr =
            selectedIndices.map((i) => optionRef(pq.options, i)).join(", ") ||
            "(none)";
          const correctStr = uniqCorrect
            .map((i) => optionRef(pq.options, i))
            .join(", ");

          let text: string;
          if (dontKnow) {
            text = `User selected "...?" — they did not attempt an answer (a genuine knowledge gap, not a wrong guess).\nCorrect: ${correctStr}`;
          } else {
            text = `User answered ${correct ? "correctly" : "incorrectly"}.\nSelected: ${selectedStr}\nCorrect: ${correctStr}`;
          }
          if (note) text += `\nNote: ${note}`;
          if (explanation) text += `\nExplanation: ${explanation}`;
          text +=
            "\nRelay the verdict, the correct answer, and the explanation to the user now.";
          return { content: text };
        } catch (error) {
          return {
            content: `❌ quiz_grade failed: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    });
  });
}
