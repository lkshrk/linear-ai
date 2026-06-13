# Manual Runbook

Use this runbook before an orchestrator service exists. A human starts the right agent manually. Agents apply Linear labels/statuses themselves when Linear MCP write tools are available; otherwise they emit `REQUIRED_LINEAR_MUTATIONS` for the human to apply.

## Principles

- Linear remains the visible workflow surface.
- Marked comments remain the handoff contract.
- Agents apply their own state changes when MCP writes are available.
- If MCP writes are unavailable, agents emit `REQUIRED_LINEAR_MUTATIONS` and the human applies them.
- Do not advance an issue when required fields or comments are missing.
- Do not guess missing facts to keep the workflow moving.

## Intake Run

Use when starting from a rough bug report or feature idea.

1. Start `agents/issue-intake.md`.
2. Provide the rough request or existing Linear issue fields.
3. If the issue was created from a Linear template, tell the agent that and include filled fields.
4. Answer only the missing questions the agent asks.
5. Let the agent create/update the issue in Linear when MCP writes are available.
6. If MCP writes are unavailable, paste the final issue draft into Linear.
7. Apply the emitted `REQUIRED_LINEAR_MUTATIONS`: `Bug` or `Feature` if classification is clear, plus `llm-refine` when implementation planning is needed. Remove any other `llm-*` state.

Stop when the Linear issue is readable, classified, prioritized, and ready for refinement.

## Batch Queue Runs

Use batch orchestrator skills when multiple issues already carry known Linear AI workflow labels.

- `linear-batch-refine` finds `llm-refine` and `llm-blocked`, shows the queue, asks for confirmation, processes one issue at a time with `linear-refine`, completes a full pass, then groups questions and feedback by issue.
- `linear-batch-implement` finds `llm-ready` issues with newest valid ready plans, shows the queue, asks for confirmation and maximum parallelism capped at 6, then dispatches isolated `linear-implement` subagents.
- `linear-batch-close` finds `llm-review` issues, shows the queue, asks for bounded parallelism capped at 6, then dispatches `linear-close` subagents.

All batch skills support dry-run/list-only mode, optional team/project filters, priority then oldest-updated ordering, stale-state re-read before dispatch, one retry on tool/runtime failure, cancellation summaries, structured subagent results, grouped questions, feedback aggregation, and final summaries. Single-issue skills own durable per-issue Linear comments, workflow labels, dashboard updates, PR handoff, closeout mutations, and issue-specific interpretation.

## Refinement Run

Use when an issue has `llm-refine`.

1. Start `agents/questioner.md`.
2. Provide the Linear issue URL, issue body, comments, labels, and relevant links.
3. Let the agent inspect relevant repository context when available.
4. Answer one question at a time.
5. Continue until all material questions are answered or you explicitly accept listed unknowns.
6. Let the agent write the marked plan comment and update labels when MCP writes are available.
7. If MCP writes are unavailable, paste the marked plan comment and apply `REQUIRED_LINEAR_MUTATIONS`.

Stop when the newest marked plan comment has `plan_status: ready`.

Tip: when working from a copied Linear thread, use `scripts/extract_marked_comment.ts` to isolate the newest marked plan comment before validation.

## Implementation Run

Use when an issue has `llm-ready`.

1. Start `agents/implementer.md` in the target Coder workspace or equivalent repo workspace.
2. Provide the Linear issue URL and newest marked ready plan comment.
3. Confirm target repository or repositories.
4. Let the implementer create or update the branch and draft PR.
5. Let it complete every unambiguous checklist item.
6. Let the agent write its marked status comment and update labels/status when MCP writes are available.
7. If MCP writes are unavailable, paste the status comment and apply `REQUIRED_LINEAR_MUTATIONS`.

Stop when the implementer has posted status, opened or updated a draft PR, and reported verification evidence or blockers.

## Blocked Loop

Use when the implementer posts batched questions.

1. Add `llm-blocked` if the issue is blocked by open questions and the implementer did not already apply it. Remove any other `llm-*` state.
2. Start `agents/questioner.md`.
3. Provide the newest status comment and its questions.
4. Answer/refine until blockers are resolved or explicitly deferred.
5. Let the questioner write a new marked plan comment with incremented revision when MCP writes are available.
6. If MCP writes are unavailable, paste the new marked plan comment and apply `REQUIRED_LINEAR_MUTATIONS`.
7. Re-run `agents/implementer.md` against the newest ready plan.

Stop when implementation can continue without assumptions.

Tip: use `scripts/extract_marked_comment.ts --kind status` to isolate the newest implementer status comment from a copied thread.

## Review Handoff

Use when implementation is complete.

1. Confirm the implementer status says `implementation_status: review_ready`.
2. Confirm draft PR links exist.
3. Confirm required tests/checks passed or gaps are explicitly accepted.
4. Let the implementer add `llm-review`, remove every other `llm-*` state, move Linear status to In Review, and mark the PR ready when MCP/GitHub tools are available.
5. If writes are unavailable, apply the emitted `REQUIRED_LINEAR_MUTATIONS`.

Stop when a human reviewer can evaluate the PR without needing to reconstruct agent state.

## Failure Handling

Stop and repair before continuing when:

- marked YAML is invalid
- YAML and Markdown conflict
- target repository is missing
- `plan_status: ready` is absent
- questions are unresolved and not accepted as unknowns
- a template field is filled with vague filler
- an agent starts inventing product behavior
