# Linear AI

Linear AI is a development workflow kit for using Linear as the source of truth for AI-assisted feature delivery.

It gives agents a repeatable path for one issue:

1. Create or clean up the Linear issue.
2. Refine it into an implementation-ready plan.
3. Track progress in one dashboard block in the issue description.
4. Implement in an issue worktree, verify through bounded review rounds, integrate into main, and close only after mainline evidence is proven.

## Workflow Guarantees

- Ticket references include the issue ID, exact issue title, and a one-line description whenever an agent switches focus.
- Issue claims use the `in-use` label plus a Linear-visible claim block so other agents can detect active or stale work.
- Implementation always happens in `<repo>/.worktrees/<issue-id>-<optional suffix>`, never directly on branch working trees, `main`, or `master`.
- The implementation review loop runs at most five rounds by default and posts a round summary after each round.
- The default integration path is to rebase the issue worktree onto the local main branch, squash to the minimal number of reviewable commits, and integrate into main.
- A ticket is complete only when the code is in the main branch. An open PR is review handoff evidence, not completion evidence, unless the issue explicitly requires a different terminal path.

## Install

### Codex, Claude Code, And Other Skill Runtimes

The direct install path is the `skills` CLI. It installs the portable `SKILL.md` files from this repository into supported agent runtimes.

Install all skills into Codex and Claude Code:

```sh
npx skills add lkshrk/linear-ai --agent codex --agent claude-code
```

Install only the full delivery workflow:

```sh
npx skills add lkshrk/linear-ai --skill linear-deliver-feature --agent codex
```

List available skills before installing:

```sh
npx skills add lkshrk/linear-ai --list
```

### Plugin Marketplace Mode

This repository ships Codex and Claude Code plugin manifests:

- `.codex-plugin/plugin.json`
- `.claude-plugin/plugin.json`

Public plugin marketplace installation should use a separate tap-style marketplace repository, not this source repository directly. See [Marketplace Distribution](docs/marketplace.md).

Install from the `lkshrk` marketplace:

```sh
codex plugin marketplace add lkshrk/agent-marketplace
codex plugin add linear-ai@lkshrk
```

```sh
claude plugin marketplace add lkshrk/agent-marketplace
claude plugin install linear-ai@lkshrk
```

### Linear MCP

Configure Linear MCP when the agent should read or update Linear:

```sh
codex mcp add linear --url https://mcp.linear.app/mcp
codex mcp login linear
```

## Required Linear Setup

Run `linear-doctor` against live Linear metadata before using the workflow in a new workspace. It verifies that agents can discover teams, projects, labels, statuses, and the mutations needed to keep issue state consistent.

Required workflow labels:

- `llm-refine` - issue needs clarification or planning.
- `llm-ready` - issue has an accepted implementation plan.
- `llm-active` - implementation is in progress.
- `llm-blocked` - issue is blocked and needs user input or external change.
- `llm-review` - implementation is ready for review or closeout evidence.
- `llm-split` - issue is too large and must be split.
- `in-use` - claim label used with the Linear-visible claim block to prevent duplicate active work and detect stale claims.

Required Superpowers labels:

- `sp-clarify`
- `sp-plan`
- `sp-implement`
- `sp-review`
- `sp-verify`

Required planning labels and conventions:

- Use a `bug` or `feature` type label, or the workspace's equivalent type labels, on normal work items.
- Use an `EPIC` label for larger features or changes that span multiple systems.
- An EPIC issue is a container with a title, description, out-of-scope section, references, and linked work-package issues.
- Work-package issues carry the normal `llm-*` workflow label and reference their EPIC when they are part of one.
- Exactly one `llm-*` workflow label should be active on an issue at a time. The `in-use` claim label may coexist with that workflow label while an agent owns the issue.

Recommended status mapping:

- `llm-refine` -> backlog, triage, or todo status.
- `llm-ready` -> ready status.
- `llm-active` -> in-progress status.
- `llm-blocked` -> blocked status.
- `llm-review` -> in-review status.
- Done/complete status only after closeout evidence proves the code reached the required integration target.

Target teams, projects, component labels, priorities, and milestone conventions are workspace-specific. Agents should read them from Linear metadata instead of hardcoding local names.

## Skills

- `linear-create-issue` - turn a rough report or idea into a Linear-ready issue.
- `linear-refine` - interview, clarify, and write a ready implementation plan.
- `linear-implement` - execute a ready plan in an issue worktree, update progress, run bounded review rounds, and integrate through the mainline path.
- `linear-close` - verify mainline evidence from a merged PR, direct issue-ID commit, or squash/import release evidence and close the Linear issue after review.
- `linear-batch-refine` - list refinement/blocker queues and run `linear-refine` per issue.
- `linear-batch-implement` - list ready issues, confirm bounded parallelism, and run isolated `linear-implement` subagents.
- `linear-batch-close` - list review issues, confirm bounded parallelism, and run `linear-close` per issue.
- `linear-deliver-feature` - run the full create/refine/implement/review/closeout workflow.
- `linear-status` - inspect an issue and recommend the next workflow step.
- `linear-doctor` - check required Linear teams, projects, and labels.
- `linear-review` - run parallel reviewers, dedup findings, and turn survivors into Linear tickets.

## Usage

Start from actual Linear state:

```text
Use linear-status to inspect HCL-123 and tell me the current phase.
```

Prepare an issue:

```text
Use linear-create-issue for this feature idea. Query available teams, projects, and Linear labels first; propose matching tags and ask whether to add more.
```

Refine a plan:

```text
Use linear-refine on HCL-123. Grill me until the plan is implementation-ready.
```

Deliver a feature:

```text
Use linear-deliver-feature on HCL-123. Keep Linear updated with the issue description dashboard and status comments.
```

Process a queue:

```text
Use linear-batch-implement for H-cloud Linear-AI issues. Show the queue, ask for parallelism, and dispatch isolated linear-implement subagents.
```

Close a reviewed issue after a merged PR, direct issue-ID commit, or squash/import release:

```text
Use linear-close on HCL-123 after the PR is merged, an issue-ID commit is on main, or current main has the expected release file/content evidence with passing release/main checks.
```

An open PR alone is not enough to complete a ticket. Closeout requires proof that the code is on the main branch, unless the issue itself explicitly defines another terminal path.

## Local Development

Clone the repo:

```sh
git clone git@github.com:lkshrk/linear-ai.git
cd linear-ai
```

Install dependencies with the JavaScript package manager available in your environment:

```sh
bun install
# or
npm install
# or
pnpm install
```

Run checks:

```sh
make test
make validate
make verify-handoff
make install-smoke
make skills-smoke
make skills-sync          # mirror referenced files into each skill dir after editing docs/agents/templates/scripts/schemas
make skills-sync-check    # fail if any skill bundle is stale (runs in pre-commit)
make marketplace-generate
make marketplace-smoke
make release-check
bun scripts/create_release.ts patch --dry-run
```

## Repository Layout

- `skills/` - portable agent skills. Each skill bundles copies of the root files its `SKILL.md` references (kept in sync by `make skills-sync`) so `npx skills add` installs a self-contained skill.
- `.codex-plugin/plugin.json` - Codex plugin manifest.
- `.claude-plugin/plugin.json` - Claude Code plugin compatibility manifest.
- `agents/` - runnable agent role prompts.
- `templates/` - Linear issue and marked comment templates.
- `schemas/` - machine-readable YAML schemas.
- `scripts/` - validators and install smoke checks.
- `docs/install.md` - detailed install notes.
- `docs/reviewer.md` - linear-review pipeline, dedup, triage, and ledger contract.
- `docs/marketplace.md` - tap-style marketplace distribution.
- `docs/tools.md` - helper command reference.
- `docs/superpowers-linear-persistence.md` - Linear dashboard persistence contract.

## Release

Tags matching `v*.*.*` run CI. If CI succeeds, the release workflow verifies the same commit and publishes the GitHub release.

## License

MIT. See [LICENSE](LICENSE).
