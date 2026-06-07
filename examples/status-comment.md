# Example Status Comment

````markdown
<!-- linear-ai:status v1 issue=CIV-123 plan_rev=1 status_rev=1 -->

```yaml
schema: linear-ai.status.v1
issue_id: CIV-123
plan_revision: 1
status_revision: 1
implementation_status: blocked
draft_prs:
  - repository: backend
    url: https://github.com/civora/backend/pull/123
  - repository: web
    url: https://github.com/civora/web/pull/456
completed_items:
  - I1
blocked_items:
  - I2
skipped_items: []
placeholders: []
questions:
  - id: Q1
    blocks:
      - I2
    question: Which workflow-run statuses should be shown as warning colors on the overview?
verification:
  - check: backend tests
    result: passed
    reason: Recent workflow run retrieval is covered.
  - check: web tests
    result: not_run
    reason: UI status-color behavior is blocked by Q1.
recommended_labels_to_apply:
  - llm-blocked
recommended_labels_to_remove: []
recommended_status: Blocked
```

## Summary

Backend data retrieval is implemented. Web rendering is blocked on confirmed status-color behavior.

## Completed

- `I1` Added recent workflow run retrieval.

## Blocked or Skipped

- `I2` Blocked until status-color behavior is confirmed.

## Questions

1. `Q1` Which workflow-run statuses should be shown as warning colors on the overview?

## Placeholders

None.

## Verification

- Backend tests - passed.
- Web tests - not run; blocked by `Q1`.

## PRs

- `backend` - https://github.com/civora/backend/pull/123
- `web` - https://github.com/civora/web/pull/456

## Recommended Next State

Add `llm-blocked` and keep PRs draft.

<!-- /linear-ai:status -->
````
