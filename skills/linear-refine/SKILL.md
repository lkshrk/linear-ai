---
name: linear-refine
description: "Refine a Linear issue into a ready implementation plan through targeted questions, local review, and marked plan comments. Use when an issue needs clarification, planning, accepted unknowns, acceptance criteria, or a `llm-ready` handoff."
---

# Linear Refine

Use the repository root as the workflow source. Read and follow:

- `agents/questioner.md`
- `docs/questioner.md`
- `docs/agent-required-passes.md`
- `docs/superpowers-linear-persistence.md`
- `templates/linear-plan-comment.md`
- `schemas/linear-ai.plan.v1.schema.yaml`

Ask one question at a time. Run the required local review/grill pass before marking a plan ready.

## Claim Lock

Follow the Claim Lock Rule in `docs/workflow.md`. On start, re-read the issue; if it already carries `in-use` and this run is not resuming its own claim, stop and report the issue as claimed without changing it. Otherwise add the `in-use` label when claiming the issue. Remove `in-use` when this run stops working the issue: on ready handoff, blocked, or abandoned. `in-use` is outside the `llm-*` namespace, so release it explicitly.

When claiming, also write the `linear-ai:claim` block to the issue description (`templates/linear-claim-block.md`) with `claimed_by: linear-refine` and an ISO 8601 `claimed_at`, preserving other description content. When releasing, remove the claim block.

## Questionnaire Start

Before writing a ready plan, decide from source evidence whether a questionnaire is needed. Source evidence includes the issue, comments, linked docs, and codebase inspection. If no material ambiguity remains, record that no questionnaire was needed and continue to the ready plan.

If material ambiguity remains after source evidence is exhausted, start a real questionnaire/interview path instead of relying on copied grill prose. Use `grill-me` or `grill-with-docs` when available, but do not require those skills to be installed. If they are unavailable, run the fallback directly: ask exactly one concrete question, include your recommended answer, wait for the user's response, then update the plan draft before asking the next question.

Do not mark `plan_status: ready` until the questionnaire evidence shows that every material ambiguity was either answered or explicitly accepted as unknown.

## Grill Continuation

Interview the human relentlessly about every material branch of the plan until there is shared understanding. Walk the design tree one decision at a time, resolve dependencies between decisions, and provide the recommended answer for each question.

Ask one question at a time. If a question can be answered by exploring the issue, comments, linked docs, or codebase, explore those sources instead of asking.

After each human answer, restate the accepted decision, update the plan draft or Linear comment when available, and ask if there is anything else to add for that branch. If yes, continue the current step with the next focused question. If no and the branch is resolved, move to the next branch or recommend moving to the next workflow step.

Do not mark `plan_status: ready` until grill continuation has completed for every material branch or the human has explicitly accepted the remaining unknowns.

## Linear MCP Contract

Use these Linear MCP tools when available:

- `get_issue` - read current issue fields, labels, status, and branch metadata.
- `list_comments` - read existing marked plan/status comments before creating a new revision.
- `save_comment` - post the marked plan comment or reply to the relevant thread.
- `save_issue` - apply `llm-ready`, remove other `llm-*` labels, add the `in-use` claim on start and remove it on stop, and update status when writes are available.

Validate marked plan comments with:

```sh
scripts/validate_marked_comments.ts <plan-comment-file>
```

If a Linear metadata snapshot is available, validate labels with:

```sh
scripts/validate_marked_comments.ts --metadata <metadata.json> <plan-comment-file>
```

Use the local JavaScript package manager or runtime available to the agent: Bun can run the `.ts` scripts directly; Node/npm/pnpm/yarn environments should run them through a TypeScript runner such as `tsx`.

If Linear MCP write tools are unavailable, do not claim labels, status, or comments were updated. Emit `REQUIRED_LINEAR_MUTATIONS` with the exact comment body and label/status changes.

## Step Completion Handoff

When refinement completes a draft, blocked, or ready plan revision, report what changed, the validation/write evidence, current Linear labels/status, and the recommended next step.

Ask if there is anything else to add for this refinement step. If yes, continue the current step and update the plan. If no, recommend moving to the next workflow step, normally `linear-implement` when `llm-ready` is present or another grill branch when ambiguity remains.

After the add-more question is answered "no", ask whether the user wants to continue with the recommended next skill. Name the recommended next skill explicitly and wait for user confirmation; do not auto-run it.

Use this response shape:

- Current phase
- What changed
- Evidence
- Missing evidence
- Open blocker
- Recommended next step
- Recommended next skill
- Question: Is there anything else to add before moving on?
- Question: Do you want to continue with the recommended next skill?

Stop when the newest marked plan comment is `plan_status: ready`, labels/status mutations are applied or emitted, and no unaccepted blocking questions remain.
