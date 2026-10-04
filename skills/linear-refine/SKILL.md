---
name: linear-refine
description: "Refine a Linear issue until its description is a valid implementation-ready issue: resolve material ambiguity one question at a time, fill the eleven template sections, validate and move it to Todo. Use when an issue is in Backlog, was reported in plain language, or failed validation."
---

# Linear Refine

Read and follow `docs/workflow.md` (state, claiming, comments), `templates/issue.md` (the sections) and
`templates/forms.md` (the forms people file and how they map into the sections).

Batch mode: when asked for several issues, discover Backlog issues in scope, show the queue, and refine one
issue at a time; collect each issue's questions before moving on.

## 1. Claim

Read the issue and its comments. Skip it if someone else is actively working on it
(`docs/workflow.md` → Claiming) or it belongs to nightshift. Set yourself as assignee; the issue stays in
Backlog while you refine.

## 2. Gather Evidence

Read the issue, its comments, linked documents and the code it touches. Answer from these sources whatever
they can answer; ask the human only what they cannot.

A description in form shape (Feature, Bug or Improvements fields) is translated with the mapping in
`templates/forms.md`: the original report moves under `## Why` unchanged, the affected systems come from
the code, and the desired outcome or expected behaviour becomes testable acceptance criteria. A
plain-language report (it has a `<!-- linear-ai:intake-nontech -->` comment) needs this translation with
extra care, since its words are the reporter's, not technical terms.

## 3. Questions

Decide whether material ambiguity remains: any branch where product behaviour, UX, scope or data
semantics could reasonably differ, and any fix-design choice with more than one plausible option, even
when the code favours one. Purely mechanical choices (naming, file placement, copying an identical
existing pattern) you decide yourself.

If ambiguity remains, ask exactly one concrete question at a time, each with your recommended answer and
the evidence for it. After each answer, restate the decision, update your draft, and continue with the
next open branch. Use `grill-me` or `grill-with-docs` if installed; the rule is the same without them.
An unknown the human explicitly accepts goes into `## Constraints` as `Accepted unknown: …`.

When running as a batch subagent without a human channel, relay each question to the orchestrator and
wait for the answer; do not guess.

When the human is unavailable, post the batched questions as one `<!-- linear-ai:blocked -->` comment
mentioning them and move the issue to Blocked.

## 4. Write The Description

Fill every section of `templates/issue.md` in the issue description, keeping any useful existing text:

- `## Files`: repository-relative paths or globs only; this is the expected touch set.
- `## Acceptance criteria` and `## Tests expected`: one checkable list item each.
- `## Verify`: the exact commands, in a fenced block.
- `## Design excerpt`: a link to the design document and section, or `none` for a small fix.
- `none` is allowed in Interfaces in/out, Constraints and Out of scope.

An issue too large for one worktree session is split into child issues, each with its own valid
description; the parent keeps the shared context.

## 5. Validate And Hand Off

Save the description to a file and run `scripts/validate_issue.ts <file>` (`--require-design` when the
project uses design documents). Fix every reported problem. Then move the issue to Todo, optionally add
`ai-stage:implementation` when nightshift should continue it, and post one `<!-- linear-ai:refined -->`
comment summarising what was clarified.

If Linear write tools are unavailable, print the exact description, status change and comment for the
human to apply.

## Handoff

Finish with: current status, what changed, open or accepted unknowns, and the recommended next skill
(normally `linear-implement`). Ask whether the human wants to continue with it; do not run it automatically.
