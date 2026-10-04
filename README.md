# Linear AI

Linear AI is a development workflow kit for using Linear as the source of truth for AI-assisted delivery,
in Codex, Claude Code and other agent runtimes.

It gives agents a repeatable path for one issue:

1. Create the issue (`linear-intake`).
2. Refine its description into an implementation-ready issue (`linear-refine`).
3. Implement it in an issue worktree, review it in bounded rounds, integrate into main and close it once
   the change is proven on main (`linear-implement`).

The workflow state is the Linear status; the plan is the issue description. See `docs/workflow.md`.

## Workflow Guarantees

- Ticket references include the issue ID, exact issue title, and a one-line description whenever an agent switches focus.
- An agent acts only on issues the human names, issues delegated or assigned to the AI app, or issues with the opt-in label (default `autopilot`).
- The claim is the assignee or delegate plus In Progress; a stale claim is taken over with a comment.
- An issue is Todo only when its description passes `scripts/validate_issue.ts`.
- Implementation always happens in `<repo>/.worktrees/<issue-id>-<optional suffix>`, never directly on `main` or `master`.
- The review loop runs at most five rounds by default.
- A ticket is Done only when the code is on the main branch, proven by `scripts/verify_closeout.ts`. An open PR is handoff evidence, not completion.
- The state model matches nightshift's, so manual sessions and nightshift can share a workspace.

## Install

### Codex, Claude Code, And Other Skill Runtimes

The direct install path is the `skills` CLI. It installs the portable `SKILL.md` files from this repository into supported agent runtimes.

Install all skills into Codex and Claude Code:

```sh
npx skills add lkshrk/linear-ai --agent codex --agent claude-code
```

Install only the implementation skill:

```sh
npx skills add lkshrk/linear-ai --skill linear-implement --agent codex
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

Run `linear-status` in doctor mode before first use in a workspace. It checks against live Linear data that
every team in scope has the statuses Backlog, Todo, In Progress, In Review, Blocked (type started), Done and
Canceled, that type labels exist, and whether v1 labels are still in use.

No workflow labels are required. Optional:

- an opt-in label (default `autopilot`) for issues an agent may pick up on its own;
- `ai-stage:<stage>` labels, only for issues meant to continue in nightshift.

### Upgrading From v1

v1 kept the state in `llm-*` labels, an `in-use` claim label, plan/status comments and a dashboard block.
Run `linear-status` in migrate mode: it maps every open v1 issue to a status, moves usable plan content into
the description, shows the full list of changes, and applies it after approval. The v1 labels are archived
only after every open issue is migrated.

## Skills

- `linear-intake` - turn a rough report, idea or a non-technical person's report into a Linear issue in Backlog.
- `linear-refine` - clarify an issue one question at a time and write its description in the template until it validates; moves it to Todo. Batch mode for several issues.
- `linear-implement` - claim a ready issue, implement it in a worktree with bounded review rounds, integrate into main, verify and close. Batch mode for several issues.
- `linear-status` - show where an issue stands and the next step; doctor mode for workspace setup; migrate mode for v1.
- `linear-review` - run parallel reviewers, dedup findings, and turn survivors into Linear tickets.
- `linear-reconcile` - bring issue-linked branches, worktrees, commits and PRs back in line with Linear.

## Usage

Start from actual Linear state:

```text
Use linear-status to inspect HCL-123 and tell me the current phase.
```

File an issue:

```text
Use linear-intake for this feature idea. Query teams, projects and labels first; propose matching labels and ask whether to add more.
```

Refine it:

```text
Use linear-refine on HCL-123. Grill me until the description is implementation-ready.
```

Implement and close it:

```text
Use linear-implement on HCL-123.
```

Process a queue:

```text
Use linear-implement in batch mode for the Todo issues of the Linear-AI project. Show the queue and ask for parallelism.
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
make install-smoke
make skills-smoke
make skills-sync          # mirror referenced files into each skill dir after editing docs/templates/scripts/schemas
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
- `templates/` - the issue template and the review-finding footer.
- `schemas/` - the review-ledger schema.
- `scripts/` - validators and install smoke checks.
- `docs/install.md` - detailed install notes.
- `docs/reviewer.md` - linear-review pipeline, dedup, triage, and ledger contract.
- `docs/marketplace.md` - tap-style marketplace distribution.
- `docs/workflow.md` - the workflow rules: scope, state, claiming, comments, implementation.
- `docs/agent-required-passes.md` - grill pass, review loop and self-gates.
- `docs/review-lanes.md` - review lanes, finding shape and fingerprint.

## Release

Tags matching `v*.*.*` run CI. If CI succeeds, the release workflow verifies the same commit and publishes the GitHub release.

## License

MIT. See [LICENSE](LICENSE).
