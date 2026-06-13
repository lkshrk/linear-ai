<!-- linear-ai:dashboard v1 issue=CIV-999 dashboard_rev=1 -->

```yaml
schema: linear-ai.dashboard.v1
issue_id: CIV-999
dashboard_revision: 1
current_phase: implement
llm_state: llm-active
sp_phases:
  - sp-clarify
  - sp-plan
  - sp-implement
tasks:
  - id: T1
    state: done
    emoji: "✅"
    title: Add failing dashboard contract tests
    evidence: test/agent_contract.test.ts
  - id: T2
    state: in_progress
    emoji: "🔄"
    title: Implement dashboard template and schema
    evidence: templates/linear-dashboard-comment.md
  - id: T3
    state: todo
    emoji: "⬜"
    title: Run full verification
    evidence: ""
blockers: []
next_step: Finish implementation and run verification.
updated_by: linear-ai
```

## Dashboard

Current phase: implement

- ✅ `T1` Add failing dashboard contract tests
- 🔄 `T2` Implement dashboard template and schema
- ⬜ `T3` Run full verification

## Blockers

- None

## Recommended Next Step

Finish implementation and run verification.

<!-- /linear-ai:dashboard -->
