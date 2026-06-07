# Agent Required Passes

These passes are part of every Linear AI agent contract. They are local instructions, not optional external skills. If an external skill such as `grill-me` or `grill-with-docs` is available, use it; otherwise run the local pass here exactly.

## Completion Rule

An agent is not finished until it has either:

- performed the required Linear writes with Linear MCP tools, or
- emitted a `REQUIRED_LINEAR_MUTATIONS` block listing the exact labels, status, comments, and PR actions that a human or finalizer must apply.

Do not end with only "recommended next state" when the issue state needs to change.

## Mandatory Local Grill Pass

Use this pass before any questioner marks a plan `ready`.

1. Restate the implementation goal in one sentence.
2. Identify every branch where product behavior, repository ownership, data shape, security posture, rollout, migration, tests, or reversibility could vary.
3. For each branch, answer from source material when possible.
4. If source material cannot answer it, ask one concrete question at a time and include the recommended answer.
5. Continue until every material branch is resolved, explicitly deferred, or listed as an accepted unknown.
6. Convert resolved decisions into acceptance criteria, implementation checklist items, verification checks, and `do_not_assume` entries.

Do not set `plan_status: ready` while any unresolved question remains unless the same item is listed in `accepted_unknowns` and protected by `do_not_assume`.

## Linear Finalization Pass

Use this pass at the end of every agent run.

Exactly one `llm-*` workflow state label may be present on an issue at a time:

- `llm-refine`
- `llm-ready`
- `llm-active`
- `llm-blocked`
- `llm-review`
- `llm-split`

Whenever an agent adds one of these labels, it must remove every other `llm-*` workflow state label in the same finalization pass. Product/component labels such as `Bug`, `Feature`, `API`, or `Web` are independent and may coexist.

If Linear MCP write tools are available, apply the exact state changes after producing the marked comment or issue draft. If a write fails, report the failed write and emit `REQUIRED_LINEAR_MUTATIONS`.

If Linear MCP write tools are not available, emit:

```text
REQUIRED_LINEAR_MUTATIONS
- issue: TEAM-123
- add_labels: [...]
- remove_labels: [...]
- status: ...
- comment: plan | status | issue body | none
- pr_action: draft | ready | none
```

## Issue Intake State

When intake produces a clean issue draft:

- apply or emit product label `Bug` or `Feature` when classification is clear
- apply or emit `llm-refine` when implementation planning is needed
- when applying `llm-refine`, remove `llm-ready`, `llm-active`, `llm-blocked`, `llm-review`, and `llm-split`
- never apply `llm-ready`
- leave status in Backlog/Todo unless the human supplied another target status

## Questioner State

When the questioner produces a valid ready plan:

- create or update the marked plan comment
- add `llm-ready`
- remove `llm-refine`, `llm-active`, `llm-blocked`, `llm-review`, and `llm-split`
- move status to Todo/Ready when that status exists; otherwise leave the current status unchanged

When the plan is still blocked or draft:

- create or update the marked plan comment
- add `llm-refine`
- remove `llm-ready`, `llm-active`, `llm-blocked`, `llm-review`, and `llm-split`
- do not add `llm-ready`

## Implementer State

When implementation starts from a ready plan:

- add `llm-active`
- remove `llm-refine`, `llm-ready`, `llm-blocked`, `llm-review`, and `llm-split`
- move status to In Progress

When blocked by questions:

- add `llm-blocked`
- remove `llm-refine`, `llm-ready`, `llm-active`, `llm-review`, and `llm-split`
- create the marked status comment with batched questions
- do not add `llm-review`

When blockers are resolved and implementation can resume:

- add `llm-active`
- remove `llm-refine`, `llm-ready`, `llm-blocked`, `llm-review`, and `llm-split`

When implementation is review-ready:

- create the marked status comment
- add `llm-review`
- remove `llm-refine`, `llm-ready`, `llm-active`, `llm-blocked`, and `llm-split`
- move status to In Review
- mark the draft PR ready only when tests/checks and placeholders satisfy the implementer contract

## Orchestrator State

The orchestrator remains the deterministic fallback and repair agent. It must apply or emit the same finalization mutations and must never silently continue past invalid marked comments.
