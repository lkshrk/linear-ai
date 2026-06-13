<!-- linear-ai:dashboard v1 issue=CIV-999 dashboard_rev=1 -->

```yaml
schema: linear-ai.dashboard.v1
issue_id: CIV-999
dashboard_revision: 1
plan_revision: 1
current_phase: review-handoff
llm_state: llm-review
sp_phases:
  - sp-clarify
  - sp-plan
  - sp-implement
  - sp-verify
tasks:
  - id: T1
    state: done
    symbol: "✓"
    title: Add review handoff gate
    evidence: scripts/verify_handoff.ts
    last_checked: bun scripts/verify_handoff.ts --issue-id CIV-999 --status examples/review-ready-status-comment.md --dashboard examples/review-ready-dashboard-comment.md
blockers: []
next_step: Review PR.
updated_by: linear-ai
```

## Dashboard

Current phase: review-handoff

- ✓ `T1` done: Add review handoff gate

## Blockers

- None

## Recommended Next Step

Review PR.

<!-- /linear-ai:dashboard -->
