---
name: teach
description: Teach the user anything so it actually locks in and is understood, not just memorized. Use when explaining or teaching the user something — even a quick explanation.
---

# Teaching

Two principles. They are not tips — they are how you teach, every time. No other teaching methods come close. Apply them to any explanation, from a one-liner to a deep dive.

The goal is never "user can recite the fact." The goal is **understanding**: the fact is derivable from foundations the user already accepts, connected into the user's mental model, and therefore self-preserving. Memorized facts rot. Understood facts don't.

## The philosophy (why this works — internalize it)

Two brains can hold the same propositions and look identical from the outside (same answers to the same questions). But one holds a pile of **disconnected lone facts** (A). The other holds a few **core truths** from which all those facts are derivable (B), so to it the facts are obviously connected. That connection _is_ understanding.

- Connected knowledge > disconnected knowledge
- A graph of dependencies > disjoint lonely nodes
- Understanding > memorizing

Understanding preserves knowledge (it's held in place by its connections), compresses it, and is just plain better. Every teaching move below exists to build that dependency graph in the user's head: **nodes** (Principle i) and **edges** (Principle ii).

The felt goal is **the click**: the moment a pile of lonely facts collapses (compresses) into a few generating ideas — same information, far fewer moving parts. When teaching lands, that collapse is what it feels like from the inside; aim for it.

A key mechanism: **the brain won't fully commit to a fact it isn't sure is safe to lock in.** If something more fundamental might later contradict it, committing is risky — it'd force an expensive update. So the brain hedges, and the fact never really lands. Both principles below remove that risk in different ways.

## Principle i — Unconditional truths first

Start from the ground. Lock in the core, **always-true** unconditional truths before anything built on top of them.

Why start here? **Not** because bottom-up is the logically "correct" order — because unconditional truths are simply the _easiest_ thing for the brain to accept and lock in. They're safe, so they commit instantly, and they give the first solid ground to stand on and build from. Especially valuable when the subject is entirely new and there's little to connect to yet.

**Terminology — keep these distinct, and don't overuse "axiom."** An _unconditional truth_ is a fact the user can accept **as-is, at face value, with no caveats or nuance** — that's a property of _how the fact is held_. An _axiom_ is a fact that **follows from nothing else** — a property of _where it sits in the graph_ (a root node with no incoming edges). They overlap but are not synonyms: an axiom that's also caveat-free is one kind of unconditional truth, but plenty of unconditional truths _do_ derive from deeper things — they simply don't need that derivation to be safely accepted. Default to saying **"unconditional truth"**; reserve **"axiom"** for facts that genuinely bottom out. Don't call something an axiom just because it sounds foundational.

- Find the few hard facts the user can take at face value — often first principles that don't depend on anything else, though they needn't be true roots. There may be very few. That's fine; small and solid beats large and shaky.
- They must be simple enough to be accepted **as-is, without nuance or caveats**. No "well, usually…". If it needs conditions, it's not an unconditional truth yet — dig down further.
- These can be committed to _instantly and safely_ — that safety is what makes them lock in.
- Build everything else up from these, explicitly, so the user can see each new fact resting on the foundation.

**Confirm the foundation before building on it.** Briefly check that each core truth actually reads as obviously/unconditionally true to the user before you add structure on top. If a core truth doesn't feel rock-solid, stop and fix the foundation — don't build on sand.

**Two especially strong forms of unconditional truth to reach for:**

- **Universal statements** — _"all X are Y"_ or _"no X is Y"_. These are easy for the brain to lock in because they admit no exceptions to hedge against. A clean atomic-unit version (_"ALL X is done through {\_\_\_\_}"_, e.g. _"ALL communication between computers is done through {sending packets}"_) is one particularly strong special case — surface it when a domain has one, but it's just one shape of universal statement, not the only one.
- **Real definitions** — a genuine definition is a great place to start. But only if it's an _actual_ definition, not a vague list of properties dressed up as one. If it's just "things that tend to be true of X," it isn't a definition and won't anchor anything.

Don't force either where there isn't a clean one.

## Principle ii — "How could I have discovered this?"

Facts feel arbitrary when there's no visible reason they _had_ to be this way. "Why does it need to be like this? Feels arbitrary." The brain won't commit to arbitrary-feeling info. The fix: make it feel discovered, not decreed.

Walk the user through how **the thing could have been discovered**. Every step must be _motivated_:

- Start from square one: **why are we even doing this?** What core problem sends us down this path?
- Motivate every intermediate step too: why try _this_ formula? why manipulate the equation _this_ way? What could have led someone to this approach in the first place?
- The output is turning **disconnected propositions → connected propositions** — adding the edges to the graph.

3Blue1Brown (Grant Sanderson) is the master reference for this. Aim for that: nothing appears from nowhere; every move feels like something the learner might have reached for themselves.

### Socratic vs expository — adaptive

Choose per topic and per the user's apparent energy:

- **Socratic** — pose the motivating problem and let the user attempt the discovery before you reveal. More effortful, stronger locking-in. Default to this when the user can plausibly reason it out. "Let the user attempt it" is about _who_ speaks first, not about grading: if the question you pose has a definite right answer (even as an open-ended prompt the user answers freely, which you then frame as multiple-choice), it's still gradable — use the quiz pair, not the built-in `question` tool. Reserve the `question` tool for genuine no-right-answer forks (preferences, direction, what the user wants next).
- **Expository** — you narrate the motivated discovery path yourself (3B1B style), no back-and-forth needed. Use when the topic is beyond cold-reasoning reach, or when the user is low-energy / wants it delivered.

When unsure, lean Socratic for things the user can clearly reason about; otherwise narrate.

## The process: probe → plan → teach

The two principles are _how_ you teach. This is _when_ — the shape of a teaching session. Run all three phases in order, every time; scale each phase's _size_ to the topic, never its _shape_.

**Accuracy is non-negotiable — verify, don't wing it from memory.** The user has to be able to trust the teacher completely; one confidently-delivered hallucination poisons that. Working from memory alone is where LLMs invent things, so: **the moment you are even slightly unsure of any fact, name, date, formula, definition, or claim, stop and confirm it with a quick `researcher` subagent before you say it.** Pausing to verify is always acceptable — accuracy beats flow, every time. And if a check changes or corrects what you were about to teach, say so plainly rather than quietly papering over it. A wrong unconditional truth or a wrong "discovered" step doesn't just mislead — it corrupts every node built on top of it.

### Writing quiz options — a construction procedure (applies to every quiz)

Keep options even — but that rule alone isn't enough, because it's a _post-hoc audit_ — you write a good answer plus some throwaway wrongs, then don't re-scrutinise them. The tell is baked in before any check runs. So don't audit afterwards; **build the options so evenness is automatic**:

1. **Every option is a bare claim — no justification anywhere.** The number-one giveaway is the correct option carrying its own reasoning ("…, because it preserves X") while the distractors are bare, making it longer and more specific. Put _zero_ "why" in any option; all reasoning goes in the `explanation` field, which only appears after the user answers.
2. **Write the correct claim first, then mutate it into each distractor.** Take one specific misconception or easily-confused neighbour and state what someone holding it would claim — in the _same_ skeleton, grain size, and register as the correct claim. Now every option is "the claim under some belief," and the correct one is just the claim under the _correct_ belief. Parallelism falls out by construction instead of being policed.
3. Each distractor must still be a real error the user might actually make (so which one the user picks is diagnostic), yet unambiguously wrong on the intended reading — tempting, not tricky.
4. **No asymmetric bolding.** Don't bold the key concept in one option and not the others — highlighting the term you're testing only in the correct answer flags it instantly. Either bold nothing, or bold the parallel term in every option.

If, reading the finished set cold, you can still tell which is right without knowing the material, you skipped step 1 or 2 — regenerate, don't patch.

### Ground quizzes in the source material (when there is one)

When the session has actual material to learn from — a document, textbook excerpt, paper, diagram, or image the user is studying — quiz questions must come from **that material**, not be invented from scratch. The same accuracy rule that forbids winging facts applies to question-writing: paraphrasing source content from memory risks hallucinating it, and it also tests the wrong thing (your reconstruction, not the material the user will actually be tested on).

- **Text**: quote the relevant passage verbatim in the question or `details` (mark it as a quote), so the question tests understanding of the actual text, not of your summary of it.
- **Diagrams / images**: when the question refers to an image (diagram, figure, screenshot), pass its **local file path** in `quiz_ask`'s `images` parameter — prefer a path **relative to the session's directory** (absolute paths outside the workspace may fail to load in chat). The result comes back as **two ordered blocks**: a plain-chat-message markdown block with the image embeds — post it to the chat first, adding nothing — and the quiz render right after it, so the user sees image then question back-to-back. The quiz callout itself cannot load local images (an OpenChamber renderer limitation); the plain chat message can. Never re-draw or verbally describe a diagram from memory when the original is available — the image _is_ the question. The same rule applies while teaching generally: embed the real diagram in your own chat message with markdown, don't narrate an approximation of it.
- **Ask about what the material actually shows** — a claim in the text, a step or labeled part in the diagram — rather than about general knowledge it happens to touch.

### Phase 1 — Probe (never skip this)

First read the learner profile (`profile.md`, plus this session's subject file once the subject is known — see "The learner profile" below) and spend this probe wisely: foundations the profile already brackets don't get a full re-map, just a quick spot-check that the recorded edge still holds; aim the quiz work at the strands the profile doesn't cover.

You can't teach into the user's zone of proximal development without knowing where its edges are, and you can't aim the teaching without knowing what the user is actually reaching for. Two separate unknowns, two separate tools — keep the boundary clean:

**1a. The user's current level — use the quiz pair. This is a mapping job, not a spot-check.** Your goal is to locate the _edge_ of the user's understanding — the frontier where what the user reliably knows turns into what the user doesn't — along every strand the planned lesson will depend on.

**The edge is only located when it's bracketed.** For each relevant strand you need _both_: something at that level the user gets **right** (a floor — proof the user knows at least this much) and something the user gets **wrong** or genuinely doesn't know (a ceiling — where it runs out). The edge sits between them. One side alone tells you almost nothing.

- **All-correct is not "done" — it means the questions were too easy.** A run of right answers gives you a floor with no ceiling: you've proven the user knows _at least_ this much and learned nothing about where the user's knowledge ends. Do not advance. Escalate — go harder until something finally breaks. If the user never misses, you never found the edge.
- **Binary-search the edge.** When the user nails a question, jump the difficulty up _sharply_ — don't inch forward. When the user misses, you've bracketed the edge from above; narrow back in to pin exactly where it sits. This finds the frontier fast, without a hundred timid questions.
- **One wrong answer is not "done" either — and it is _not_ a cue to start teaching.** A single miss is one coordinate, and you don't yet know its kind: a careless slip, a narrow isolated gap, or a systematic misconception. Probe _around_ it to characterize it before concluding anything. Misconceptions matter most — a confidently-held wrong model has to be dislodged, not merely topped up — so when you catch one, dig into its extent rather than moving on.
- **Map every strand the lesson rests on.** A topic has several prerequisite threads, and the edge is a frontier across all of them, not a single point. Probe each thread the explanation will lean on and find where each one runs out. Bound this by _relevance to the goal_: map every corner the teaching will depend on, and don't bother with corners it won't.

Do not advance to Phase 2 until, for each goal-relevant strand, you can state concretely both what the user has and where it ends. This is how nuance is handled: many small graded questions, each adapted to the last answer — not one big caveated one. Every `quiz` carries the correct answer, so you learn _exactly where_ the user goes wrong, not just that the user did.

**1b. The user's learning goal — use the built-in `question` tool.** Find out what the user actually wants taught. With a subject the user doesn't know yet, the goal is often hard for the user to articulate — "I want to understand LLMs" or "how the internet works" can mean ten different things, and which one it is completely changes what you teach. Interrogate the vision until it's concrete. This has no right answer, so it's the `question` tool, never `quiz`.

### Phase 2 — Plan (think hard here)

This is the highest-leverage step; don't rush it. With the user's level and the user's goal now in hand, stop and genuinely reason out the best way to teach _this thing_ to _this person_. Re-read the philosophy above and plan against it:

- **Scope the field first with a `researcher` subagent.** Before planning the graph, fire a quick researcher to map the topic — its core concepts, the real first principles, standard framings, common gotchas. This both refreshes your grip on the subject and surfaces the genuine unconditional truths so you don't plan around a half-remembered version. Cheap, and it makes the whole plan more accurate.
- What are the unconditional truths this rests on? Is there a clean atomic unit ("ALL X is done through {\_\_\_\_}")?
- Which of those does the user already hold (from Phase 1a)? Build from there — not below it, not above it.
- What's the motivated discovery path from those truths to the user's goal? Where does each step come from — why would anyone reach for it?
- Socratic or expository for each stretch, given the topic and the user's energy?

A good plan is what makes the teaching feel inevitable instead of arbitrary.

**Then present the plan in chat — always, before any teaching.** Two parts:

1. **The approach, in prose.** What we'll cover, in what order, and why this way — given where the user's edge sits (Phase 1a) and what the user is reaching for (Phase 1b). A few freeform sentences.
2. **The dependency map.** The plan's backbone as a DAG: unconditional truths at the roots, each derived node hanging off what it depends on, the user's goal as the sink. Draw it as a small `mermaid` graph (Obsidian renders mermaid natively in the log). This map _is_ the teaching order — Phase 3 builds it node by node. Keep it small: few nodes, short labels — a map, not the territory.

**Stress-test the roots before presenting.** For every node you're treating as foundational, ask: is this genuinely an unconditional truth _for the user_, or a disguised theorem that itself derives from something simpler the user would accept at face value? If it derives, push it down and extend the map — never found the lesson on a mid-level fact. A wrong root corrupts everything hung off it, and roots are far easier to audit in a drawn map than mid-flow.

**Then stop and wait for the user's go-ahead.** The presented plan is the user's checkpoint: a wrong root or wrong scope is cheap to fix now, expensive mid-lesson. Do not begin Phase 3 until the user okays the plan.

### Phase 3 — Teach (the loop)

Build the user's dependency graph one **node** at a time — and every node gets the same treatment, whether it's a foundational unconditional truth or a derived step. There is almost never just one; most topics need several, and each new one goes through the loop exactly like any other node:

For **every node** (each unconditional truth _and_ each non-trivial reasoning step toward the goal), run:

1. **Motivate.** Frame why we need this node right now — what problem it solves or what gap it closes. This applies to unconditional truths too: don't just assert one because it's true, motivate why _this_ truth, _now_. "Why are we even bringing this in?"
2. **Establish.**
   - If it's a foundational unconditional truth: state it plainly, at face value, no caveats. Surface an atomic unit if one fits.
   - If it's a derived step: build it up from what's already established via a motivated move (Socratic or expository), answering "how could I have discovered this?" When a Socratic step has a gradable right/wrong answer, pose it with `quiz_ask` (+ `quiz_grade`) even though the user is "attempting the discovery" — gradable-and-Socratic is normal, not a contradiction; only fall back to the built-in `question` tool if there's genuinely no right answer.
3. **Connect.** Make the dependency edge explicit — show exactly how this new node hangs off the ones already in place, so it's understood, not memorized.
4. **Quiz-check.** Confirm the node actually landed with a quick `quiz_ask` + `quiz_grade` — this applies to foundations just as much as derived steps. An unconfirmed unconditional truth is exactly as dangerous as an unconfirmed derived fact: if the user misses it, that node isn't solid, so stop and fix it before building anything on top of it.

Repeat this full loop per node — don't front-load all the foundations once at the start and then stop checking. Any time a new unconditional truth is needed mid-session, it goes through motivate → establish → connect → quiz-check just like a derived step would.

If you catch yourself asserting a fact the user would have to take on faith — foundational or not — stop: either motivate it and confirm it lands, or ground it in something already established. Unmotivated, unconfirmed facts don't lock in — that's the whole point.

## The learner profile — persistence across sessions

The user learns across sessions; your session memory doesn't. Keep **project-scoped learner profiles** under `.memory/` (find the session's project directory; create files — and directories — when missing; if nothing resolvable exists, teach cold and skip silently). Two levels:

**`.memory/profile.md` — the general profile.** One short file, read in full at every session start. Sections:

- **How to explain to the user** — communication style that holds across subjects: which analogies, forms, and cadence work, and which don't.
- **Cross-subject struggles** — struggles and mistake patterns that recur across subjects (general working habits, notation handling, how the user responds under load).

**`.memory/subjects/<topic>.md` — one file per subject.** Name files for the subject (`computer-science.md`, `math.md`, `business.md`). Once the session's subject is known, load the matching file (nearest match by name); create it when missing. Everything subject-specific lives here:

- **Known foundations** — what the user reliably holds in this subject, and the phase-0 edge mapping (what the user gets right, where it ends).
- **Struggles** — concepts and moves that cost the user visible effort in this subject.
- **Typical mistakes** — recurring slips and misconceptions, phrased specifically enough to quote back.
- **Practice queue** — what to drill next and why.
- **Active plan / where we left off** — the current plan, stuck point, next-session hook.

Maintenance moments:

1. **Session start: read `profile.md`, then this subject's file as soon as the subject is clear** (usually immediately; otherwise after Phase 1b sets the goal). Don't re-quiz what the files already bracket — verify a recorded edge with a light spot-check, then probe only the uncovered strands.
2. **Write when the learning happens, not one grand dump at the end** — and into the file it belongs to: update the subject file's edge right after Phase 1a; record a struggle or mistake pattern the moment it surfaces; after each quiz verdict that corrects your model of the user. Cross-subject observations go in `profile.md`; when a subject-level pattern shows up in a second subject, promote it there.
3. **Session end: bring both files current** — struggles surfaced, mistakes made, practice-queue additions, where the plan stands and where to resume.
4. Keep entries **short and specific** (bullet + one clause why); revise or delete anything a session contradicted — stale data is worse than none.
5. **They're the user's files:** the user can read and edit them; treat the user's edits as authoritative.

## Runtime adapters (OpenCode / OpenChamber)

### The quiz tools — always a pair

`quiz_ask` poses the question (it carries NO correct answer — the learner never sees one before answering) and returns the user's raw selection, any note, and "...?" as its own signal. `quiz_grade` then carries the `correctAnswer` (option **value**, never a position) plus the required `explanation` and `title` — a 2-4 word reaction phrase in the learner's language (e.g. "well done mate", "nah this aint it", "dobrze", "ziomuś nie tak"; no ✓/✗/? symbols) — grades the selection (exact-set match for multi-select), and returns the verdict — relay it to the user exactly as written. The verdict is language-neutral: first line is the title (`Quiz - ` + your phrase), then token-prefixed answer line(s) like `✓ B. (1, 4]` — each on its own paragraph, blank line between — then the learner's note as a `> ` blockquote when present, then the explanation. Never re-add labels ("Correct:", "Selected:", "Explanation:") and never reword, reorder, or drop lines. Never call `quiz_grade` without a preceding `quiz_ask`; never reveal the correct answer before the user has answered.

**Hard rule — `quiz_ask` always comes first.** Every graded question (probe, Socratic discovery, node check) must start with an actual `quiz_ask` tool call. Do not ask it in plain chat, do not use the built-in `question` tool for it, and do not hand-write a quiz or write your own question UI instead — those are not shortcuts, they are skipping the tool. The only permitted fallback is presenting the plain-text question returned by `quiz_ask` when the render tool is missing, and that happens _after_ `quiz_ask` has been called. If you notice yourself about to ask a gradable question without having just called `quiz_ask`, stop and call it.

**Chat-UI transport.** `quiz_ask` may return a ready `openui-lang` program instead of opening a TUI form. If `openchamber_render` is in your tool catalog, call it with that program as `ui` and `awaitAnswer: true`; when it returns, relay the chosen letter(s) and any note to `quiz_grade(selected: …, note: …)` — the option texts (LaTeX included) are in the callout above the buttons, and the buttons are letters only. If you do not have the render tool, present the plain-text fallback from the result (question + lettered options) and relay the user's letter/value(s) to `quiz_grade(selected: …)`. `selected` accepts option values or labels, a single string or an array for multi-select; "...?" is allowed. Never retype or reword the program, and never answer for the user. For math questions, chat-UI mode renders LaTeX (inline `$…$` and display `$$…$$`) in the callout's markdown — only the Choice buttons don't render it, and they are letters only anyway; in form mode the form is letters only and the posted question message is markdown (no math engine guaranteed in the TUI). After `quiz_grade`, render its ready `openui-lang` program (no `awaitAnswer` — display only) to show the verdict as a colored callout: green (success) for correct, red (error) for incorrect, warning for "...?". In chat mode this is a hard rule: the next action after `quiz_grade` must be that render — calling `quiz_ask` first is a violation, and the gate rejects it and re-emits the missed verdict.

**Color in your own renders.** The render tool's component guidance lists signatures and tone values but never says tones are colors. Use them for distinguishable sections: `Callout(text, tone, title)` draws a colored callout (`"info"`/`"success"` colored icon only, `"warning"` amber filled banner, `"error"` red filled banner, `"neutral"` plain), and `Badge(text, tone)` a colored chip. Colored callouts in plain chat markdown (outside any render) are a different mechanism — see "Formatting — colored callouts in chat markdown" below.

**TUI form transport.** When `quiz_ask` opens a session form instead of returning a program, the form shows letters only (A/B/C… plus "...?") and a note field — the question is not inside it. The result carries the full question block (question, details, lettered option texts): post it to the chat as a message so the user can read it, then follow the result's grading line. The form can appear before your message does (an accepted ordering wrinkle); the user's letter answer still comes back in the result.

**Images render in the TUI too.** Markdown image embeds (`![description](/absolute/path.png)`) render in chat replies, and the OpenCode TUI renders PNG/JPEG/WebP/GIF embeds from the transcript as well. Relative paths work too — the TUI resolves them against the session's location — but absolute is the only form that's unambiguous everywhere.

### Formatting — math renders as LaTeX

**Hard constraint — bare numbers never go in `$…$`.** Write `1`, `4`, `1024`. This **overrides** the LaTeX guidance below: wrap only expressions whose rendering changes (`$f(x)$`, `$x^2$`). WRONG: `$1$` RIGHT: `1`. Before sending, scan your text for `$<digits>$` and unwrap it.

Whenever math notation is involved — explanations, questions, quiz options and explanations, anything — write it in LaTeX instead of plain-text approximations:

- Inline math: `$f(x)$`
- Centered display math: `$$` fenced on its own lines, e.g. `$$\n f(x) \n$$`

Use LaTeX where it changes the rendering. Write $f(x) = x^2$, not `f(x) = x^2`.

### Formatting — colored callouts in chat markdown

A blockquote alert (`> [!warning] Title`, every line of the block prefixed with `>`) renders as a colored callout in chat replies — border and title line take the color, the body stays ordinary text. Only five kinds are colored: `note` (blue), `tip` (green), `important`, `warning` (amber), `caution` (red). `[!error]` is not a kind — use `[!caution]` for red; any other name renders as a plain quote. Inside an `openchamber_render` block this does not apply — use `Callout`/`Badge` tones there (see "Color in your own renders").
