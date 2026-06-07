# Tools

Small local helpers for the Markdown-first workflow.

## Repo Commands

Run the full helper test suite:

```sh
make test
```

Install helper dependencies first when starting from a fresh checkout. Use the package manager available in your environment:

```sh
bun install
pnpm install
npm install
```

The examples below use Bun because it can execute the TypeScript files directly. In Node/npm/pnpm/yarn environments, run the same `.ts` scripts through a TypeScript runner such as `tsx`, for example `pnpm exec tsx scripts/validate_marked_comments.ts ...`.

Detect the preferred local runner:

```sh
bun scripts/detect_runner.ts
```

Validate plan/status templates and examples:

```sh
make validate
```

Run local repository self-review checks for stale helper/runtime naming:

```sh
make self-review
bun scripts/self_review.ts
```

Run local install smoke checks for plugin manifests, skill paths, and package scripts:

```sh
make install-smoke
bun scripts/install_smoke.ts
```

Render sample bug/feature issue bodies:

```sh
make render-examples
```

## Linear MCP

Linear MCP setup is documented in `docs/linear-mcp.md`.

The setup command is credential-gated:

```sh
codex mcp add linear --url https://mcp.linear.app/mcp
codex mcp login linear
```

Run it only when you are ready to authorize Codex against Linear.

## Marked Comment Validator

Validate marked Linear plan/status comments:

```sh
bun scripts/validate_marked_comments.ts [--metadata metadata.json] FILE [FILE...]
```

Examples:

```sh
bun scripts/validate_marked_comments.ts examples/plan-comment.md examples/status-comment.md
bun scripts/validate_marked_comments.ts --metadata linear-metadata.json copied-plan-comment.md
```

The validator checks:

- required start/end markers
- fenced YAML parseability
- required schema fields
- valid `plan_status` and `implementation_status`
- known Linear labels when `--metadata` is provided
- ready plans do not contain unresolved open questions unless accepted
- status comments contain verification entries

It does not call Linear and does not mutate files.

## Linear Metadata Helper

Capture a local metadata snapshot from Linear MCP read results:

```sh
bun scripts/linear_metadata.ts capture --teams linear-teams.json --projects linear-projects.json --labels linear-labels.json > linear-metadata.json
npm run metadata:capture -- --teams linear-teams.json --projects linear-projects.json --labels linear-labels.json > linear-metadata.json
```

Create those input files from current Linear MCP results:

- `list_teams` output -> `linear-teams.json`
- `list_projects` output -> `linear-projects.json`
- `list_issue_labels` output -> `linear-labels.json`

The capture command accepts raw wrapper objects from those tools, direct arrays, or arrays of paginated wrapper objects. It prints warnings to stderr when required metadata groups are missing, for example when no Component labels exist.

Validate local issue metadata against the captured snapshot:

```sh
bun scripts/linear_metadata.ts summary --metadata metadata.json
bun scripts/linear_metadata.ts validate --metadata metadata.json --target-team Civora --target-project "Public Beta" --component-tag Web --type-label Feature --llm-label llm-refine
```

Create the snapshot from current Linear MCP results. It should contain:

```json
{
  "teams": [{ "name": "Civora" }],
  "projects": [{ "name": "Public Beta", "teams": [{ "name": "Civora" }] }],
  "labels": [{ "name": "Web", "parent": "Component" }]
}
```

The helper does not call Linear directly. Skills and agents query Linear MCP for live teams, projects, and labels, then use this helper for deterministic local capture and checks.

## Intake Renderer

Render a structured intake YAML file into a Linear issue body plus routing metadata:

```sh
bun scripts/intake_issue.ts --metadata metadata.json INPUT.yaml
bun scripts/intake_issue.ts --metadata examples/linear-metadata.json examples/intake-feature-input.yaml
```

The input must include `target_team`, `target_project`, and `component_tag`; the metadata snapshot validates those values before output.

## Marked Comment Extractor

Extract the newest marked comment from copied Linear text:

```sh
bun scripts/extract_marked_comment.ts [--kind plan|status|any] FILE
```

Examples:

```sh
bun scripts/extract_marked_comment.ts --kind plan copied-linear-thread.md
bun scripts/extract_marked_comment.ts --kind status copied-linear-thread.md
```

Defaults to `--kind plan`.

The extractor:

- finds complete marked plan/status blocks
- returns the latest matching block by file order
- prints only the marked block
- fails when no matching marked comment exists

It does not validate the extracted comment. Run the validator on the extracted block or source file before acting on it.

## Issue Renderer

Render a Linear bug or feature issue body from structured YAML:

```sh
bun scripts/render_issue.ts INPUT.yaml
```

Examples:

```sh
bun scripts/render_issue.ts examples/bug-input.yaml
bun scripts/render_issue.ts examples/feature-input.yaml
```

The renderer:

- supports `type: bug` and `type: feature`
- uses the field names from `docs/issue-intake.md`
- fails when required fields are missing
- does not render priority; priority is a structured Linear property
- does not infer missing issue content

It prints Markdown suitable for a Linear issue body.

## Tests

Run helper tests:

```sh
bun test
```
