# Linear AI Workflow

Markdown-first operating manual for AI-assisted Linear issue refinement and implementation.

This repository defines the contracts for issue-intake, questioner, implementer, and future orchestrator agents. It does not own Civora product facts. Approved product and workflow-domain facts belong in the `spec` repository or in Linear issue comments.

## V1 Scope

V1 is intentionally documentation-only:

- no always-on service
- no required central AI memory backend
- no automated Linear label mutation
- no hidden product assumptions

Agents can use these files directly as prompts or skills. Later, a deterministic orchestrator can enforce the same contracts through Linear MCP/API, Coder workspaces, and PR automation.

Runnable agents are self-finalizing: when Linear MCP write tools are available, they apply their own safe workflow label/status transitions. When writes are unavailable, they emit `REQUIRED_LINEAR_MUTATIONS` so the exact final state is not left implicit. Only one `llm-*` workflow state label may be active on an issue at a time.

## Plugin Skills

The repo is also a Codex plugin scaffold. The primary skill surfaces are:

- `linear-create-issue` - ingest a rough report or idea into a Linear-ready issue.
- `linear-refine` - clarify an issue into a ready marked implementation plan.
- `linear-implement` - execute a ready plan, verify, PR, and post status.
- `linear-deliver-feature` - run create/refine/implement/review as one end-to-end workflow.
- `linear-status` - inspect a Linear issue and report current phase, missing evidence, and next skill.
- `linear-doctor` - check Linear teams, projects, labels, and setup readiness.

## Quick Start

```sh
make test
make validate
```

Use [Install](docs/install.md), [Agent Usage](docs/agent-usage.md), and [Manual Runbook](docs/manual-runbook.md) to run the workflow manually or install the skills into Codex, Claude Code, and other agents.

## Core Flow

1. An issue-intake agent helps turn a rough bug or feature thought into a clean Linear issue.
2. The issue receives `llm-refine` when it needs implementation planning.
3. A questioner agent interviews the human until the issue is ready or the human explicitly accepts remaining unknowns.
4. The questioner writes a marked plan comment and the issue becomes `llm-ready`.
5. A future orchestrator picks up `llm-ready`, creates or selects an implementation workspace, and starts an implementer agent.
6. The implementer completes every unambiguous task, opens or updates a draft PR, and posts batched questions when blocked.
7. The questioner resumes on those questions, updates the plan, and the implementer continues.
8. Agents use one `linear-ai.dashboard.v1` dashboard comment for Superpowers task progress instead of creating comment spam.
9. When the PR is complete and verified, it is marked ready for human review.

## Documents

- [Issue Intake Agent](agents/issue-intake.md) - runnable prompt for issue creation.
- [Questioner Agent](agents/questioner.md) - runnable prompt for refinement.
- [Implementer Agent](agents/implementer.md) - runnable prompt for implementation.
- [Orchestrator Agent](agents/orchestrator.md) - runnable prompt for future coordination.
- [Workflow](docs/workflow.md) - labels, statuses, lifecycle, splitting, PR rules.
- [Install](docs/install.md) - portable skill, Claude Code, and Codex plugin installation.
- [Linear Setup](docs/linear-setup.md) - labels, templates, statuses, and bot identity.
- [Linear MCP](docs/linear-mcp.md) - Codex/Linear MCP setup and safety contract.
- [Setup Checklist](docs/setup-checklist.md) - concrete checklist for finishing the repo and Linear setup.
- [Agent Usage](docs/agent-usage.md) - manual invocation guide for each agent.
- [Issue Intake](docs/issue-intake.md) - bug and feature issue creation contract.
- [Questioner](docs/questioner.md) - refinement interview contract.
- [Implementer](docs/implementer.md) - implementation contract.
- [Orchestrator](docs/orchestrator.md) - future deterministic coordinator.
- [Memory Policy](docs/memory-policy.md) - what counts as durable truth.
- [Manual Runbook](docs/manual-runbook.md) - how to run the workflow before automation exists.
- [Comment Validation](docs/comment-validation.md) - checklist for marked Linear comments.
- [Automation Roadmap](docs/automation-roadmap.md) - staged path from manual Markdown to orchestrator.
- [Tools](docs/tools.md) - local helper commands for extracting and validating marked comments.
- [Plugin Manifest](.codex-plugin/plugin.json) - repo-local Codex plugin manifest.
- [Project Facts](memory/project-facts.md) - approved durable facts for this workflow repo.
- [Bug Issue Template](templates/linear-bug-issue.md) - bug issue fields and formatting.
- [Feature Issue Template](templates/linear-feature-issue.md) - feature issue fields and formatting.
- [Plan Comment Template](templates/linear-plan-comment.md) - marked plan comment format.
- [Status Comment Template](templates/linear-status-comment.md) - implementation status and question format.
- [Dashboard Comment Template](templates/linear-dashboard-comment.md) - one-comment progress dashboard format.
- [Plan Comment Schema](schemas/linear-ai.plan.v1.schema.yaml) - machine-readable plan YAML schema.
- [Status Comment Schema](schemas/linear-ai.status.v1.schema.yaml) - machine-readable status YAML schema.
- [Dashboard Comment Schema](schemas/linear-ai.dashboard.v1.schema.yaml) - machine-readable dashboard YAML schema.
- [Superpowers Linear Persistence](docs/superpowers-linear-persistence.md) - dashboard and `sp-*` persistence contract.
- [Example Bug Issue](examples/bug-issue.md) - filled bug issue example.
- [Example Feature Issue](examples/feature-issue.md) - filled feature issue example.
- [Example Bug Input](examples/bug-input.yaml) - structured input for the issue renderer.
- [Example Feature Input](examples/feature-input.yaml) - structured input for the issue renderer.
- [Example Intake Feature Input](examples/intake-feature-input.yaml) - structured input for intake rendering with routing metadata.
- [Example Linear Metadata](examples/linear-metadata.json) - example snapshot shape for local metadata validation.
- [Example Plan Comment](examples/plan-comment.md) - filled marked ready-plan comment.
- [Example Status Comment](examples/status-comment.md) - filled marked implementation status comment.
- [Example Dashboard Comment](examples/dashboard-comment.md) - filled marked dashboard comment.

## Authority Model

Authoritative sources, highest to lowest:

1. Explicit human instruction in the active issue/refinement session.
2. Marked Linear plan comments.
3. Approved docs in the `spec` repository.
4. Current repository code and tests.
5. Local code-intelligence tools such as codebase-memory-mcp.
6. Optional memory tools such as Cognee, Graphiti, or Mem0.

Agents must not treat recalled memory as truth unless it points back to Linear, repo docs, code, tests, or another approved source.

## Non-Negotiable Rule

Agents must never guess product behavior, API shape, UX behavior, data migrations, security posture, or acceptance criteria. If a fact is unknown, the agent asks or records an explicit open question.
