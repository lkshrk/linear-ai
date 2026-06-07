---
name: linear-implement
description: "Execute a ready Linear implementation plan: make code changes, verify them, open or update PRs, and post marked implementation status comments. Use when a Linear issue already has a ready plan and needs implementation."
---

# Linear Implement

Use the repository root as the workflow source. Read and follow:

- `agents/implementer.md`
- `docs/implementer.md`
- `docs/agent-required-passes.md`
- `templates/linear-status-comment.md`
- `schemas/linear-ai.status.v1.schema.yaml`

Start from the newest valid marked plan comment. Do not invent missing product behavior. If blocked, post batched questions in a marked status comment and apply or emit the correct Linear mutations.

## Linear MCP Contract

Use these Linear MCP tools when available:

- `get_issue` - read the current issue, labels, status, and branch metadata.
- `list_comments` - find the newest marked plan and status comments before acting.
- `save_comment` - post marked implementation status, questions, blockers, and review-ready evidence.
- `save_issue` - apply `llm-active`, `llm-blocked`, or `llm-review`, remove other `llm-*` labels, and update status when writes are available.

Validate status comments with:

```sh
scripts/validate_marked_comments.ts <status-comment-file>
```

If a Linear metadata snapshot is available, validate labels with:

```sh
scripts/validate_marked_comments.ts --metadata <metadata.json> <status-comment-file>
```

Use the local JavaScript package manager or runtime available to the agent: Bun can run the `.ts` scripts directly; Node/npm/pnpm/yarn environments should run them through a TypeScript runner such as `tsx`.

If Linear MCP write tools are unavailable, do not claim labels, status, or comments were updated. Emit `REQUIRED_LINEAR_MUTATIONS` with the exact marked status comment and label/status changes.

Stop when implementation is verified, PR links are present when applicable, and the issue has a marked status comment with `implementation_status` set to `review_ready`, `blocked`, `active`, or `abandoned`.
