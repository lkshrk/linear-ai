# Linear Status Comment Template

Copy this into a Linear issue comment when an implementer reports progress, blockers, or review readiness.

````markdown
<!-- linear-ai:status v1 issue=TEAM-123 plan_rev=1 status_rev=1 -->

```yaml
schema: linear-ai.status.v1
issue_id: TEAM-123
plan_revision: 1
status_revision: 1
implementation_status: blocked # active | blocked | review_ready | abandoned
draft_prs:
  - repository: backend
    url: https://github.com/example/backend/pull/123
completed_items:
  - I1
blocked_items:
  - I2
skipped_items: []
placeholders:
  - id: P1
    location: path/to/file.ts
    reason: Waiting for confirmed copy or behavior.
questions:
  - id: Q1
    blocks:
      - I2
    question: Replace with concrete implementation question.
verification:
  - check: npm test
    result: not_run
    reason: Blocked before relevant tests could run.
recommended_labels_to_apply:
  - llm-blocked
recommended_labels_to_remove:
  - llm-refine
  - llm-ready
  - llm-active
  - llm-review
  - llm-split
recommended_status: Blocked
```

## Summary

Short implementation status.

## Completed

- `I1` What was completed.

## Blocked or Skipped

- `I2` Why it is blocked.

## Questions

1. `Q1` Concrete question.

## Placeholders

- `P1` Location and why it is safe or temporary.

## Verification

- `npm test` - not run; reason.

## PRs

- `backend` - draft PR link.

## Recommended Next State

Add `llm-blocked` and keep PR draft.

## REQUIRED_LINEAR_MUTATIONS

- issue: TEAM-123
- add_labels: [`llm-blocked`]
- remove_labels: [`llm-refine`, `llm-ready`, `llm-active`, `llm-review`, `llm-split`]
- status: Blocked
- comment: status
- pr_action: draft

<!-- /linear-ai:status -->
```
````

## Validity Rules

- YAML should match `schemas/linear-ai.status.v1.schema.yaml`.
- Questions must be batched.
- Each question should name the blocked checklist item.
- Placeholders must be explicit.
- Verification must say what ran, what failed, or why it was not run.
- `review_ready` requires no unresolved blocking questions.
