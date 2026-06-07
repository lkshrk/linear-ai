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

## Claude Code Plugin Compatibility

Claude Code compatibility is provided by:

```text
.claude-plugin/plugin.json
```

That manifest declares the four skill paths explicitly so tools that understand Claude Code plugin manifests can discover the same canonical skill files:

- `linear-create-issue`
- `linear-refine`
- `linear-implement`
- `linear-deliver-feature`

The project does not duplicate skill bodies under `.claude/skills/`; use the skills CLI to install or symlink them into Claude Code.

## Codex Plugin Compatibility

Codex plugin compatibility is provided by:

```text
.codex-plugin/plugin.json
```

The Codex manifest points at `./skills/`, so the same skill files remain the source of truth.

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
