# Linear Dashboard Comment Template

Copy this into one Linear issue comment and update that one dashboard comment as progress changes.

````markdown
<!-- linear-ai:dashboard v1 issue=TEAM-123 dashboard_rev=1 -->

```yaml
schema: linear-ai.dashboard.v1
issue_id: TEAM-123
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
    title: Wire dashboard validator
    evidence: scripts/validate_marked_comments.ts
    last_checked: bun scripts/validate_marked_comments.ts templates/linear-dashboard-comment.md
  - id: T2
    state: active
    symbol: "●"
    title: Update implementer skill
    evidence: skills/linear-implement/SKILL.md
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

- ✓ `T1` done: Wire dashboard validator
- ● `T2` active: Update implementer skill
- □ `T3` todo: Run full verification

## Blockers

- None

## Recommended Next Step

Finish implementation and run verification.

<!-- /linear-ai:dashboard -->
````

## Validity Rules

- YAML should match `schemas/linear-ai.dashboard.v1.schema.yaml`.
- There should be one dashboard comment per issue.
- The task list must use CLI-style state symbols and match the machine-readable `tasks` list.
- Task IDs must match the latest ready plan checklist IDs when a plan is available.
- `last_checked` records the repo, worktree, plan, status, PR, or verification evidence used for dashboard repair.
- Update this dashboard after each task state change.
