# Linear AI

Linear AI is a portable workflow kit for using Linear as the source of truth for AI-assisted feature delivery.

It gives agents a repeatable path for one issue:

1. Create or clean up the Linear issue.
2. Refine it into an implementation-ready plan.
3. Track progress in one dashboard comment.
4. Implement, verify, and hand off for review.

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

### Codex Plugin Mode

This repository includes a Codex plugin manifest at `.codex-plugin/plugin.json`.

Codex plugin installation uses configured plugin marketplaces. Once this repository is published through a Codex marketplace source, install it with:

```sh
codex plugin marketplace add <marketplace-source> --ref v0.5.0
codex plugin add linear-ai --marketplace <marketplace-name>
```

Until a marketplace source is configured, use the `npx skills` install above or open Codex in this checkout and ask it to use the repo-local skills.

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
- `linear-deliver-feature` - run the full create/refine/implement/review workflow.
- `linear-status` - inspect an issue and recommend the next workflow step.
- `linear-doctor` - check required Linear teams, projects, and labels.

## Usage

Start from actual Linear state:

```text
Use linear-status to inspect HCL-123 and tell me the current phase.
```

Prepare an issue:

```text
Use linear-create-issue for this feature idea. Query available teams, projects, and component labels first.
```

Refine a plan:

```text
Use linear-refine on HCL-123. Grill me until the plan is implementation-ready.
```

Deliver a feature:

```text
Use linear-deliver-feature on HCL-123. Keep Linear updated with the dashboard comment and status comment.
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
- `docs/tools.md` - helper command reference.
- `docs/superpowers-linear-persistence.md` - Linear dashboard persistence contract.

## Release

Tags matching `v*.*.*` run CI. If CI succeeds, the release workflow verifies the same commit and publishes the GitHub release.

Latest release:

```sh
npx skills add lkshrk/linear-ai@v0.5.0 --list
```

## License

MIT. See [LICENSE](LICENSE).
