# Linear AI

Linear AI is a development workflow kit for using Linear as the source of truth for AI-assisted feature delivery.

It gives agents a repeatable path for one issue:

1. Create or clean up the Linear issue.
2. Refine it into an implementation-ready plan.
3. Track progress in one dashboard block in the issue description.
4. Implement, verify, hand off for review, and close after merge, verified issue-ID commit evidence, or verified squash/import release evidence.

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

## Skills

- `linear-create-issue` - turn a rough report or idea into a Linear-ready issue.
- `linear-refine` - interview, clarify, and write a ready implementation plan.
- `linear-implement` - execute a ready plan, update progress, verify, and prepare review.
- `linear-close` - verify merged PR, direct issue-ID commit, or squash/import release evidence and close the Linear issue after review.
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
make marketplace-generate
make marketplace-smoke
make release-check
bun scripts/create_release.ts patch --dry-run
```

## Repository Layout

- `skills/` - portable agent skills.
- `.codex-plugin/plugin.json` - Codex plugin manifest.
- `.claude-plugin/plugin.json` - Claude Code plugin compatibility manifest.
- `agents/` - runnable agent role prompts.
- `templates/` - Linear issue and marked comment templates.
- `schemas/` - machine-readable YAML schemas.
- `scripts/` - validators and install smoke checks.
- `docs/install.md` - detailed install notes.
- `docs/marketplace.md` - tap-style marketplace distribution.
- `docs/tools.md` - helper command reference.
- `docs/superpowers-linear-persistence.md` - Linear dashboard persistence contract.

## Release

Tags matching `v*.*.*` run CI. If CI succeeds, the release workflow verifies the same commit and publishes the GitHub release.

## License

MIT. See [LICENSE](LICENSE).
