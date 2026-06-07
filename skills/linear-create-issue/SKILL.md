---
name: linear-create-issue
description: "Create or update clean Linear issues from rough bug reports, feature ideas, or copied Linear issue drafts. Use when the user asks to ingest, triage, classify, tag, or prepare a Linear issue before implementation planning."
---

# Linear Create Issue

Use the repository root as the workflow source. Read and follow:

- `agents/issue-intake.md`
- `docs/issue-intake.md`
- `docs/agent-required-passes.md`
- `templates/linear-bug-issue.md`
- `templates/linear-feature-issue.md`

Before finalizing, query available Linear teams, query available Linear projects, and query available Linear labels. Use live Linear data to ask or propose target team, target project, matching Linear labels/tags, type label, and LLM labels. Do not use stale or hardcoded tag lists. Do not require a Component label; propose likely labels from all live Linear labels and ask whether to add more tags before finalizing.

## Linear MCP Contract

Use these Linear MCP tools when available:

- `list_teams` - read available Linear teams before choosing target team.
- `list_projects` - read available Linear projects before choosing target project.
- `list_issue_labels` - read available Linear labels before proposing labels.
- `save_issue` - create or update the Linear issue and apply labels/priority when writes are available.

Live intake sequence:

1. Run `list_teams`, `list_projects`, and `list_issue_labels`.
2. Propose target team, target project, and matching Linear labels from those live results.
3. Ask whether to add more tags unless the user already explicitly declined.
4. Only after that answer, call `save_issue` with the final label set.

Use the local JavaScript runner available in the target environment. Detect it with:

```sh
bun scripts/detect_runner.ts
```

Run TypeScript helpers with that runner, for example `bun scripts/intake_issue.ts ...`, `pnpm exec tsx scripts/intake_issue.ts ...`, or `npm exec tsx -- scripts/intake_issue.ts ...`.

After reading Linear MCP metadata, capture the raw results into the local snapshot shape before deterministic checks:

```sh
bun scripts/linear_metadata.ts capture --teams linear-teams.json --projects linear-projects.json --labels linear-labels.json > linear-metadata.json
```

Use equivalent `tsx` commands in npm/pnpm/yarn/node environments. The `--teams`, `--projects`, and `--labels` files should contain current outputs from `list_teams`, `list_projects`, and `list_issue_labels`.

Use `scripts/linear_metadata.ts validate ...` to check the captured metadata snapshot. Use `scripts/intake_issue.ts --metadata <metadata.json> <input.yaml>` only when the issue fields already exist in structured YAML and a metadata snapshot is available. Otherwise follow the agent prompt directly and use Linear MCP tools when available.

If Linear MCP write tools are unavailable, do not claim the issue was created or updated. Emit `REQUIRED_LINEAR_MUTATIONS` with the exact target team, labels, priority, and issue body the human should apply.

## Step Completion Handoff

When issue intake completes, report what changed, the Linear issue URL or `REQUIRED_LINEAR_MUTATIONS`, selected team/project and proposed labels/tags, current Linear labels/status, and the recommended next step.

Ask if there is anything else to add for this intake step. If yes, continue the current step and update the issue draft or Linear issue. If no, recommend moving to the next workflow step, normally `linear-refine` when `llm-refine` is present.

After the add-more question is answered "no", ask whether the user wants to continue with the recommended next skill. Name the recommended next skill explicitly and wait for user confirmation; do not auto-run it.

Use this response shape:

- Current phase
- What changed
- Evidence
- Missing evidence
- Open blocker
- Recommended next step
- Recommended next skill
- Question: Is there anything else to add before moving on?
- Question: Do you want to continue with the recommended next skill?

Stop when the issue body is Linear-ready and the final metadata is explicit: target team, target project if applicable, proposed matching labels/tags, labels to apply/remove, priority if provided, whether the user wants to add more tags, and whether `llm-refine` is needed.
