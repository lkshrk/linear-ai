---
name: linear-refine
description: "Refine a Linear issue into a ready implementation plan through targeted questions, local review, and marked plan comments. Use when an issue needs clarification, planning, accepted unknowns, acceptance criteria, or a `llm-ready` handoff."
---

# Linear Refine

Use the repository root as the workflow source. Read and follow:

- `agents/questioner.md`
- `docs/questioner.md`
- `docs/agent-required-passes.md`
- `templates/linear-plan-comment.md`
- `schemas/linear-ai.plan.v1.schema.yaml`

Ask one question at a time. Run the required local review/grill pass before marking a plan ready.

## Linear MCP Contract

Use these Linear MCP tools when available:

- `get_issue` - read current issue fields, labels, status, and branch metadata.
- `list_comments` - read existing marked plan/status comments before creating a new revision.
- `save_comment` - post the marked plan comment or reply to the relevant thread.
- `save_issue` - apply `llm-ready`, remove other `llm-*` labels, and update status when writes are available.

Validate marked plan comments with:

```sh
scripts/validate_marked_comments.ts <plan-comment-file>
```

If a Linear metadata snapshot is available, validate labels with:

```sh
scripts/validate_marked_comments.ts --metadata <metadata.json> <plan-comment-file>
```

Use the local JavaScript package manager or runtime available to the agent: Bun can run the `.ts` scripts directly; Node/npm/pnpm/yarn environments should run them through a TypeScript runner such as `tsx`.

If Linear MCP write tools are unavailable, do not claim labels, status, or comments were updated. Emit `REQUIRED_LINEAR_MUTATIONS` with the exact comment body and label/status changes.

Stop when the newest marked plan comment is `plan_status: ready`, labels/status mutations are applied or emitted, and no unaccepted blocking questions remain.
