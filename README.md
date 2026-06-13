# Linear AI

Linear AI is a portable workflow kit for using Linear as the source of truth for AI-assisted feature delivery.

It provides agent skills, Markdown comment schemas, and local validators for this flow:

1. Create or clean up a Linear issue.
2. Refine it into an implementation-ready plan.
3. Track progress in one dashboard comment.
4. Implement, verify, and hand off for review.

## Skills

- `linear-create-issue` - turn a rough report or idea into a Linear-ready issue.
- `linear-refine` - interview, clarify, and write a ready implementation plan.
- `linear-implement` - execute a ready plan, update progress, verify, and prepare review.
- `linear-deliver-feature` - run the full create/refine/implement/review workflow.
- `linear-status` - inspect an issue and recommend the next workflow step.
- `linear-doctor` - check required Linear teams, projects, and labels.

## Quick Start

Install dependencies with the JavaScript package manager available in your environment:

```sh
bun install
# or
npm install
# or
pnpm install
```

Run the local checks:

```sh
make test
make validate
make verify-handoff
make skills-smoke
```

Use the skills directly from this checkout, or install them into a compatible agent runtime such as Codex or Claude Code. The workflow expects the Linear MCP server when the agent needs to read or update Linear.

Install from a published GitHub repository with:

```sh
npx skills add owner/linear-ai --agent codex --agent claude-code
```

## Typical Usage

Ask your agent to start with actual Linear state:

```text
Use linear-status to inspect HCL-123 and tell me the current phase.
```

Create or prepare an issue:

```text
Use linear-create-issue for this feature idea. Query available teams, projects, and component labels first.
```

Refine an existing issue:

```text
Use linear-refine on HCL-123. Grill me until the plan is implementation-ready.
```

Deliver a feature end to end:

```text
Use linear-deliver-feature on HCL-123. Keep Linear updated with the dashboard comment and status comment.
```

## Important Files

- `skills/` - portable agent skills.
- `agents/` - runnable agent role prompts.
- `templates/` - Linear issue and marked comment templates.
- `schemas/` - machine-readable YAML schemas.
- `scripts/` - local validators and helper commands.
- `docs/install.md` - install and no-install usage.
- `docs/tools.md` - helper command reference.
- `docs/superpowers-linear-persistence.md` - Linear dashboard persistence contract.

## License

MIT. See [LICENSE](LICENSE).
