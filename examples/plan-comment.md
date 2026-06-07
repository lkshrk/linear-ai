# Example Plan Comment

````markdown
<!-- linear-ai:plan v1 issue=CIV-123 rev=1 -->

```yaml
schema: linear-ai.plan.v1
issue_id: CIV-123
revision: 1
plan_status: ready
source_issue_url: https://linear.app/civora/issue/CIV-123/show-recent-workflow-runs
parent_issue_id: null
target_repositories:
  - backend
  - web
labels_to_apply:
  - llm-ready
labels_to_remove:
  - llm-refine
split_recommendation:
  recommended: false
  reason: null
accepted_unknowns: []
open_questions: []
implementation_checklist:
  - id: I1
    repository: backend
    task: Add an endpoint or query path for recent workflow runs for a project.
    status: todo
  - id: I2
    repository: web
    task: Render recent workflow runs on the project overview.
    status: todo
acceptance_criteria:
  - id: A1
    criterion: Project overview shows recent workflow runs with status, run time, and detail link.
  - id: A2
    criterion: Empty state is shown when no workflow runs exist.
verification:
  - id: V1
    command_or_check: Backend tests cover recent workflow run retrieval.
  - id: V2
    command_or_check: Web tests cover populated and empty recent-run states.
do_not_assume:
  - Do not invent a new workflow-run status vocabulary.
  - Do not expose runs from another project or tenant.
```

## Summary

Show recent workflow runs on the project overview so operators can spot failures without opening each workflow.

## Target Repositories

- `backend` - supplies recent workflow run data.
- `web` - renders the overview section.

## Implementation Plan

- [ ] `I1` Add backend query path for recent workflow runs.
- [ ] `I2` Render recent workflow runs on the project overview.

## Acceptance Criteria

- `A1` Project overview shows recent workflow runs with status, run time, and detail link.
- `A2` Empty state is shown when no workflow runs exist.

## Verification

- `V1` Backend tests cover recent workflow run retrieval.
- `V2` Web tests cover populated and empty recent-run states.

## Open Questions

None.

## Accepted Unknowns

None.

## Do Not Assume

- Do not invent a new workflow-run status vocabulary.
- Do not expose runs from another project or tenant.

<!-- /linear-ai:plan -->
````
