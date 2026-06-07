# Linear Plan Comment Template

Copy this into a Linear issue comment when refinement is complete or when publishing a draft refinement state.

````markdown
<!-- linear-ai:plan v1 issue=TEAM-123 rev=1 -->

```yaml
schema: linear-ai.plan.v1
issue_id: TEAM-123
revision: 1
plan_status: ready # draft | ready | blocked
source_issue_url: https://linear.app/example/issue/TEAM-123/example
parent_issue_id: null
target_repositories:
  - backend
  - web
labels_to_apply:
  - llm-ready
labels_to_remove:
  - llm-refine
  - llm-active
  - llm-blocked
  - llm-review
  - llm-split
split_recommendation:
  recommended: false
  reason: null
accepted_unknowns: []
open_questions: []
implementation_checklist:
  - id: I1
    repository: backend
    task: Replace with concrete implementation task.
    status: todo
acceptance_criteria:
  - id: A1
    criterion: Replace with observable acceptance criterion.
verification:
  - id: V1
    command_or_check: Replace with expected test, check, or manual verification.
do_not_assume:
  - Product behavior not stated here must be asked before implementation.
```

## Summary

Short human-readable summary of the intended change.

## Target Repositories

- `backend` - why this repo is involved
- `web` - why this repo is involved

## Implementation Plan

- [ ] `I1` Concrete task.

## Delivery Metadata

- Issue worktree: `../replace-with-issue-worktree`
- Git ref: `replace-with-git-ref`
- PR title: `TEAM-123: Replace with exact PR title`

## Acceptance Criteria

- `A1` Observable outcome.

## Verification

- `V1` Test/check/manual verification expected.

## Open Questions

None.

## Accepted Unknowns

None.

## Do Not Assume

- Do not use a different issue worktree, Git ref, or PR title unless the human updates the plan.
- A feature branch with PR is a final destination option, not the primary workspace where implementation happens.
- Product behavior not stated in this comment must be clarified before implementation.

## REQUIRED_LINEAR_MUTATIONS

- issue: TEAM-123
- add_labels: [`llm-ready`]
- remove_labels: [`llm-refine`, `llm-active`, `llm-blocked`, `llm-review`, `llm-split`]
- status: Todo
- comment: plan
- pr_action: none

<!-- /linear-ai:plan -->
```
````

## Validity Rules

- YAML should match `schemas/linear-ai.plan.v1.schema.yaml`.
- `plan_status: ready` is required before implementation.
- `open_questions` must be empty unless the same items are listed under `accepted_unknowns`.
- `target_repositories` must be explicit.
- Markdown must not contradict YAML.
- New revisions should increment `revision`.
