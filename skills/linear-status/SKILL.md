---
name: linear-status
description: "Inspect a Linear issue and report the current workflow phase, missing evidence, state inconsistencies, and recommended next skill. Use when the user asks what is next, where the issue stands, whether work can resume, or why labels/comments disagree."
---

# Linear Status

Use this as the read-only status and resume detector for one Linear issue. Start here when an agent is unsure what to do next.

## Linear MCP Contract

Use these Linear MCP tools when available:

- `get_issue` - read the issue description dashboard, labels, status, assignee, project, branch metadata, and links.
- `list_comments` - find the newest marked plan and status comments.

Validate marked comments and the issue description dashboard with:

```sh
scripts/validate_marked_comments.ts --description <issue-description-file> <comment-file>
```

Use the local JavaScript package manager or runtime available to the agent: Bun can run the `.ts` scripts directly; Node/npm/pnpm/yarn environments should run them through a TypeScript runner such as `tsx`.

If Linear MCP read tools are unavailable, ask for pasted issue description, labels, status, and newest marked comments. If Linear MCP write tools are unavailable or the issue state needs repair, emit `REQUIRED_LINEAR_MUTATIONS` with exact description, labels, status, and comments to apply.

## Phase Detection

Determine current phase from actual issue state, not memory:

- `setup-blocked` - required Linear labels, projects, or component/type labels are missing; run `linear-doctor`.
- `create-issue` - no Linear issue exists or intake metadata is incomplete; run `linear-create-issue`.
- `refine-plan` - issue has `llm-refine`, no valid ready plan, or open product questions; run `linear-refine`.
- `implement` - issue has `llm-ready` and newest valid plan has `plan_status: ready`; run `linear-implement`.
- `blocked` - issue has `llm-blocked` or newest status comment has unresolved questions; run `linear-refine` or ask the listed blocker question.
- `review-handoff` - issue has `llm-review` or newest status comment is `review_ready`; prepare human review.
- `repair-state` - labels, description dashboard, and comments disagree, multiple `llm-*` states are present, newest marked comment is invalid, required dashboard/status evidence is missing, or the `in-use` claim lock is stale or contradictory (see Claim Lock Check).

When labels, the description dashboard, and comments disagree, prefer validated marked evidence as evidence, then recommend the smallest description, label, or status repair.

## Claim Lock Check

Inspect the `in-use` claim lock per the Claim Lock Rule in `docs/workflow.md` and report a `claim-stale` finding under `repair-state` when the lock looks orphaned.

Tier 1 — structural contradictions (label-only, reliable). Flag `in-use` when it cannot legitimately coexist with the current state:

- the issue is Done/closed but still carries `in-use` (a missed release),
- `in-use` is present with no active work state, or with a state that releases on stop (`llm-ready`, `llm-blocked`).

`in-use` alongside `llm-refine`, `llm-active`, or `llm-review` is a legitimate held lock; do not flag it on labels alone.

Tier 2 — staleness (needs claim metadata). When the `linear-ai:claim` block is present in the description, treat the lock as stale if `now - claimed_at` exceeds the stale threshold (default 60 minutes; let the user override). Report `claimed_by` and the age. If `in-use` is present but no claim block exists, flag the mismatch (a label and claim block must be present or absent together) and fall back to the Tier 1 checks.

For any stale or contradictory lock, recommend the smallest repair: remove the `in-use` label and the `linear-ai:claim` block. Do not apply the repair unless explicitly acting as a finalizer with write tools available; otherwise emit it as `REQUIRED_LINEAR_MUTATIONS`.

## Step Completion Handoff

Report:

- Current phase
- What changed, if this status check repaired or clarified state
- Evidence from issue labels/status and newest marked comments
- Missing evidence
- Open blocker
- Recommended next step
- Recommended next skill

Ask if there is anything else to add for this status step. If yes, continue the current step by re-reading the new evidence. If no, recommend moving to the next workflow step and name the skill to run.

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

Stop after producing a phase diagnosis, missing evidence list, and recommended next skill. Do not change issue state unless explicitly acting as a finalizer with write tools available.
