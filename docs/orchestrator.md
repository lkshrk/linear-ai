# Orchestrator Contract

The orchestrator is a deterministic coordinator. It owns workflow transitions, workspace creation, and agent dispatch. It does not decide product behavior.

## V1 Status

There is no orchestrator service in v1. Humans or manual assistant sessions can follow this contract.

Future implementations should preserve these rules even if they use Linear MCP, Linear API, Coder, OMX, Hermes, or another runtime.

## Responsibilities

- watch Linear issues for AI workflow labels
- recognize issue-intake output and route it to refinement
- validate marked plan/status comments using [comment validation](comment-validation.md)
- apply label and status transitions
- create or select isolated issue worktrees
- dispatch questioner and implementer agents
- keep PR and Linear state synchronized
- recommend issue splitting
- preserve auditability

## Non-Responsibilities

The orchestrator must not:

- invent requirements
- resolve product ambiguity
- modify code directly
- silently change issue scope
- create child issues without human approval
- treat agent memory as authoritative
- override explicit human decisions

## Event Handling

### `llm-refine`

1. Start or resume questioner.
2. Wait for a marked plan comment.
3. Validate plan YAML and Markdown.
4. If `plan_status: ready`, remove `llm-refine` and add `llm-ready`.

### New bug or feature issue

1. Confirm issue has enough intake fields for its type.
2. If implementation planning is needed, add or keep `llm-refine`.
3. Do not add `llm-ready` without a valid ready plan comment.

### `llm-ready`

1. Find newest valid ready plan.
2. Determine target repository or repositories.
3. Create or resume the isolated issue worktree.
4. Remove `llm-ready`, add `llm-active`, move status to In Progress.
5. Start implementer only after passing or confirming the same required implementer permission context used by direct `linear-implement` runs: workspace write access, package manager and verification command permission, Linear MCP read/write tools, Git/GitHub tools when branch or PR work is in scope, and required project MCP tools.
6. If the required implementer permission context cannot be provided, do not dispatch a prompt-by-prompt implementer. Leave or set a blocked handoff with the missing authority.

### `llm-blocked`

1. Read newest status comment.
2. Start questioner with batched questions.
3. Wait for updated plan revision.
4. If resolved, remove `llm-blocked` and requeue implementation.

### `llm-review`

1. Ensure PR link exists.
2. Ensure implementation status says review-ready.
3. Move status to In Review if not already there.
4. Leave historical AI labels unless the team decides otherwise.

## Validation

The orchestrator must reject a plan/status comment when:

- required marker is missing
- YAML is invalid
- YAML and Markdown conflict
- `plan_status` is missing
- target repositories are missing
- ready plan contains unresolved questions not marked as accepted unknowns

Rejection should create a clear validation failure comment or report, not silently continue.

## Workspace Policy

Default implementation workspace:

- one isolated issue worktree per issue or sub-issue
- one Git ref attached to that issue worktree
- one draft PR per coherent implementation unit

Multi-repo work:

- split into sub-issues when deliverables are independently reviewable
- keep one parent tracking issue
- allow multiple PRs linked from the same issue only for small mechanical changes

## Agent Runtime Policy

Preferred v1 runtime:

- Codex/OMX/Coder manual invocation

Possible later runtime experiments:

- Hermes as worker host or scheduler
- central LeanKG for baseline code graph
- local LeanKG per implementation issue worktree
- Cognee, Graphiti, or Mem0 behind a memory interface

The workflow authority remains this contract plus Linear state, not the runtime.
