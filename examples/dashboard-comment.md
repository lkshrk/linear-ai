<!-- linear-ai:dashboard v1 issue=CIV-999 dashboard_rev=1 -->

```yaml
schema: linear-ai.dashboard.v1
issue_id: CIV-999
dashboard_revision: 1
plan_revision: 1
current_phase: implement
llm_state: llm-active
sp_phases:
  - sp-clarify
  - sp-plan
  - sp-implement
tasks:
  - id: T1
    state: done
    symbol: "✓"
    title: Add failing dashboard contract tests
    evidence: test/agent_contract.test.ts
    last_checked: bun test test/agent_contract.test.ts
  - id: T2
    state: active
    symbol: "●"
    title: Implement dashboard template and schema
    evidence: templates/linear-dashboard-comment.md
    last_checked: repo inspection
  - id: T3
    state: todo
    symbol: "□"
    title: Run full verification
    evidence: ""
    last_checked: latest ready plan
blockers: []
next_step: Finish implementation and run verification.
updated_by: linear-ai
```

## Dashboard

Current phase: implement

- ✓ `T1` done: Add failing dashboard contract tests
- ● `T2` active: Implement dashboard template and schema
- □ `T3` todo: Run full verification

## Blockers

- None

## Recommended Next Step

Finish implementation and run verification.

<!-- /linear-ai:dashboard -->
