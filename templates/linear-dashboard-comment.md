# Linear Dashboard Comment Template

Copy this into one Linear issue comment and update that one dashboard comment as progress changes.

````markdown
<!-- linear-ai:dashboard v1 issue=TEAM-123 dashboard_rev=1 -->

```yaml
schema: linear-ai.dashboard.v1
issue_id: TEAM-123
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
    title: Wire dashboard validator
    evidence: scripts/validate_marked_comments.ts
  - id: T2
    state: in_progress
    emoji: "🔄"
    title: Update implementer skill
    evidence: skills/linear-implement/SKILL.md
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

- ✅ `T1` Wire dashboard validator
- 🔄 `T2` Update implementer skill
- ⬜ `T3` Run full verification

## Blockers

- None

## Recommended Next Step

Finish implementation and run verification.

<!-- /linear-ai:dashboard -->
````

## Validity Rules

- YAML should match `schemas/linear-ai.dashboard.v1.schema.yaml`.
- There should be one dashboard comment per issue.
- The task list must use emoji state markers and match the machine-readable `tasks` list.
- Update this dashboard after each task state change.
