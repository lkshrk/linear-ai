# Setup Checklist

Use this checklist to finish the Markdown-first Linear AI workflow setup.

## Repository

- [ ] Run `make test`.
- [ ] Run `make validate`.
- [ ] Confirm `README.md` links resolve locally.
- [ ] Commit the initial Markdown/tooling set.

## Codex / Linear MCP

- [x] Configure Linear MCP for Codex using `docs/linear-mcp.md`.
- [x] Authenticate with Linear through the Codex MCP login flow.
- [ ] Confirm the MCP can read a Linear issue.
- [ ] Keep MCP write automation disabled until read-only dry runs are reliable.

## Linear Configuration

- [x] Create AI labels:
  - `llm-refine`
  - `llm-ready`
  - `llm-active`
  - `llm-blocked`
  - `llm-review`
  - `llm-split`
- [x] Create or confirm product labels:
  - `bug`
  - `feature`
- [ ] Confirm statuses map to:
  - Intake or Backlog
  - Ready
  - In Progress
  - Blocked, if used
  - In Review
  - Done
- [x] Confirm bug template fields match `docs/linear-setup.md`.
- [x] Confirm feature template fields match `docs/linear-setup.md`.
- [ ] Decide whether to create a shared bot/app user named `Civora AI`.

## Manual Agent Trial

- [ ] Create one bug issue from the Linear bug template.
- [ ] Run `agents/issue-intake.md` on it.
- [ ] Apply `llm-refine` if implementation planning is needed.
- [ ] Run `agents/questioner.md`.
- [ ] Paste a marked plan comment.
- [ ] Validate the copied plan comment with `scripts/validate_marked_comments.ts`.
- [ ] Apply `llm-ready`.

## Implementation Trial

- [ ] Pick one small ready issue.
- [ ] Run `agents/implementer.md` in the right issue worktree.
- [ ] Open or update a draft PR.
- [ ] Paste a marked status comment.
- [ ] Validate the copied status comment.
- [ ] If blocked, run the blocked loop in `docs/manual-runbook.md`.
- [ ] If complete, move to `llm-review`.

## Automation Readiness

- [ ] At least one bug and one feature have gone through intake.
- [ ] At least one issue has a valid marked plan comment.
- [ ] At least one implementation status comment validates.
- [ ] The manual process has exposed no missing required fields.
- [ ] Any repeated manual pain is recorded before building automation.
- [ ] Linear MCP read-only dry run works before controlled writes are added.

## Stop Condition

The setup is ready for real use when a human can move one issue from intake to refinement to ready plan without relying on unstated context.
