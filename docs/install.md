# Install

This repository is packaged around portable `SKILL.md` files. The same `skills/` directory is the canonical source for Codex, Claude Code, and other agents that support agent skills.

## Cross-Agent Install

Use the Vercel Labs skills CLI to install from a local checkout:

```sh
npx skills add . --skill '*' --agent '*'
```

Install only the full workflow:

```sh
npx skills add . --skill linear-deliver-feature --agent '*'
```

Install into Claude Code:

```sh
npx skills add . --skill '*' --agent claude-code
```

Install into Codex:

```sh
npx skills add . --skill '*' --agent codex
```

List discovered skills without installing:

```sh
npx skills add . --list
```

## No-install repo-local usage

You can open Codex in this directory and ask it to use the repo-local skills without installing them globally. This works best when the agent can read this checkout and has the Linear MCP server configured.

Example prompts:

```text
Use the repo-local linear-status skill to inspect HCL-123 and tell me the current phase.
```

```text
Use the repo-local linear-deliver-feature skill to deliver HCL-123. Start by checking actual Linear state.
```

```text
Use the repo-local linear-doctor skill to check whether my Linear labels, projects, and teams are ready.
```

## Claude Code Plugin Compatibility

Claude Code compatibility is provided by:

```text
.claude-plugin/plugin.json
```

That manifest declares the skill paths explicitly so tools that understand Claude Code plugin manifests can discover the same canonical skill files:

- `linear-create-issue`
- `linear-refine`
- `linear-implement`
- `linear-close`
- `linear-deliver-feature`
- `linear-status`
- `linear-doctor`

The project does not duplicate skill bodies under `.claude/skills/`; use the skills CLI to install or symlink them into Claude Code.

## Codex Plugin Compatibility

Codex plugin compatibility is provided by:

```text
.codex-plugin/plugin.json
```

The Codex manifest points at `./skills/`, so the same skill files remain the source of truth.

## Public Plugin Marketplace Install

Use the tap-style marketplace repository for public plugin installs:

```sh
codex plugin marketplace add lkshrk/agent-marketplace
codex plugin add linear-ai@lkshrk
```

```sh
claude plugin marketplace add lkshrk/agent-marketplace
claude plugin install linear-ai@lkshrk
```

## Manual Install

When an agent does not support the skills CLI, copy or symlink each folder under `skills/` into that agent's skill directory. Each skill folder must keep its `SKILL.md` file at the folder root.

## Runtime Requirements

- Use the JavaScript package manager available in the target environment: `bun`, `pnpm`, `npm`, or `yarn`.
- Bun can run the TypeScript helper scripts directly.
- Node/npm/pnpm/yarn environments should run helper scripts through a TypeScript runner such as `tsx`.
- Configure the official Linear MCP server when live Linear reads/writes are needed.
- Use the local scripts for deterministic validation and rendering.

Detect the preferred local runner with:

```sh
bun scripts/detect_runner.ts
```
