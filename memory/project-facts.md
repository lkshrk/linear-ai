# Project Facts

Approved durable facts for the Linear AI workflow project.

This file is intentionally small. Add only facts that should be reused across sessions and agents.

## Workflow Decisions

- V1 is Markdown-first. There is no required orchestrator service.
- Runnable agent prompts live in `agents/` and reference policy docs/templates instead of duplicating them fully.
- Linear comments and the `spec` repository are canonical memory.
- codebase-memory-mcp is optional code intelligence, not general workflow memory.
- Cognee, Graphiti, Mem0, Letta, and Hermes are optional future experiments, not v1 dependencies.
- Agents must not guess. Unknown facts become questions or accepted unknowns.
- Runnable agents are self-finalizing: when Linear MCP write tools are available they apply safe workflow label/status transitions; otherwise they emit `REQUIRED_LINEAR_MUTATIONS`.
- Only one `llm-*` workflow state label may be active on a Linear issue at a time.
- The first iteration uses a manually started questioner, not Linear or messenger automation.
- Issue-intake helps create bug and feature issues before refinement.
- Linear issues created or managed by this workflow always belong to the `Civora` team.
- Bug issues use these fields: Title, Problem, Expected Behavior, Actual Behavior, Reproduction Steps, Context, Evidence / Links, Priority.
- Before automation exists, humans run agents manually using `docs/manual-runbook.md`.
- Linear setup guidance lives in `docs/linear-setup.md`; manual invocation guidance lives in `docs/agent-usage.md`.
- Linear MCP setup guidance lives in `docs/linear-mcp.md`.
- End-to-end setup checklist lives in `docs/setup-checklist.md`.
- Automation should progress through `docs/automation-roadmap.md`, starting with local validation before Linear write access.
- Marked plan/status YAML schemas live in `schemas/`.
- Local marked comment validation lives in `scripts/validate_marked_comments.rb`.
- Local marked comment extraction lives in `scripts/extract_marked_comment.rb`.
- Local issue rendering lives in `scripts/render_issue.rb`.
- Questioner asks one question at a time.
- Questioner is a Linear-specific wrapper around clarification, planning, and grill discipline.
- Implementer owns repo-local TDD planning and TDD execution before code changes.
- Implementer batches questions.
- Draft PRs are allowed for partial implementation.

## Linear Setup State

- AI workflow labels have been created in Linear.
- Product labels `bug` and `feature` have been created or confirmed in Linear.
- Bug and feature Linear templates have been created.
- Linear MCP has been added to Codex and authenticated through OAuth.

## Repository Roles

- `linear-ai` owns agent and workflow operating manuals.
- `spec` owns Civora durable product/workflow facts and workflow instance data.
- `backend` owns service, API, persistence, and data behavior.
- `web` owns user interface and frontend behavior.

## Source Notes

When adding new facts, include the source Linear issue, PR, commit, or doc path where possible.
