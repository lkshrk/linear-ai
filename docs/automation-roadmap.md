# Automation Roadmap

This roadmap keeps v1 Markdown-first while defining how automation can be added without changing the contracts.

## Phase 0: Manual Markdown

Status: current.

Capabilities:

- humans start agents manually
- agents read `agents/`, `docs/`, and `templates/`
- humans paste marked comments into Linear
- humans apply labels/statuses
- draft PRs are created manually by implementers

Exit criteria:

- issue-intake, questioner, implementer, and orchestrator prompts are stable enough to use repeatedly
- plan/status comment format works in real Linear issues
- manual runbook has been exercised on at least one bug and one feature

## Phase 1: Local Helper Scripts

Add small local tools that validate and reduce copy/paste mistakes.

Candidate tools:

- validate marked plan comment with `scripts/validate_marked_comments.ts`
- validate marked status comment with `scripts/validate_marked_comments.ts`
- extract newest marked comment from copied Linear thread with `scripts/extract_marked_comment.ts`
- render issue draft from bug or feature fields with `scripts/render_issue.ts`

Constraints:

- no Linear write access required
- no service
- no hidden memory
- scripts must fail closed on invalid YAML or contradictory state

Exit criteria:

- local validation catches malformed comments before they reach Linear
- examples and templates pass validation

## Phase 2: Linear Read Automation

Add read-only Linear integration.

Candidate capabilities:

- fetch issues by label through Linear MCP
- read comments through Linear MCP
- detect newest marked plan/status comment
- produce recommended state transitions

Constraints:

- no automatic label/status mutation yet
- no issue creation without human confirmation
- no implementation dispatch

Exit criteria:

- orchestrator can produce a dry-run report for `llm-refine`, `llm-ready`, and `llm-blocked`
- Codex can authenticate to Linear MCP and read at least one issue

## Phase 3: Controlled Linear Writes

Add deterministic Linear writes.

Candidate capabilities:

- apply/remove AI labels
- move status
- create marked comments
- create approved child issues

Constraints:

- writes come only from validated structured outputs
- child issues require human approval
- product decisions still require questioner/human input

Exit criteria:

- state transitions are reliable on real issues
- audit trail is clear in Linear comments

## Phase 4: Workspace Dispatch

Add implementation orchestration.

Candidate capabilities:

- create or resume Coder workspace
- pass newest ready plan to implementer
- track draft PR links
- resume same PR after plan revision when scope is coherent

Constraints:

- implementer still owns code changes
- orchestrator never edits code
- branch-specific code intelligence runs inside the workspace

Exit criteria:

- one issue can move from `llm-ready` to draft PR and back through blocked loop

## Phase 5: Optional Shared Memory

Add memory only after the workflow is reliable.

Candidate tools:

- central LeanKG for baseline code graph
- local LeanKG in implementation workspaces
- Cognee, Graphiti, or Mem0 behind a memory interface

Constraints:

- memory is recall, not authority
- durable facts must be promoted into Linear comments, `spec`, or approved Markdown
- stale or conflicting memory must be reported

Exit criteria:

- memory reduces repeated context gathering without causing silent assumptions

## Non-Goals

- autonomous product decision-making
- replacing Linear as workflow surface
- replacing `spec` as durable Civora memory
- making Hermes or any agent runtime the workflow authority
- skipping human approval for issue splits
