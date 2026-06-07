---
name: linear-doctor
description: "Check whether a Linear workspace is ready for Linear AI workflows. Use before first run, when labels/projects are missing, when setup is uncertain, or when agents cannot decide target team, project, component, type, LLM, or Superpowers labels."
---

# Linear Doctor

Use this as the setup check before workflow execution or when setup state is uncertain.

## Linear MCP Contract

Use these Linear MCP tools when available:

- `list_teams` - read available teams.
- `list_projects` - read available projects and their teams.
- `list_issue_labels` - read type, component, LLM, and Superpowers labels.
- `save_issue` is not required; setup diagnosis is read-only unless the agent is explicitly asked to fix an existing issue.

Capture and validate live metadata with:

```sh
scripts/linear_metadata.ts capture --teams linear-teams.json --projects linear-projects.json --labels linear-labels.json > linear-metadata.json
scripts/linear_metadata.ts validate --metadata linear-metadata.json
```

Use the local JavaScript package manager or runtime available to the agent: Bun can run the `.ts` scripts directly; Node/npm/pnpm/yarn environments should run them through a TypeScript runner such as `tsx`.

If Linear MCP read tools are unavailable, ask for exported teams, projects, and labels. If Linear MCP write tools are unavailable or label creation is not supported, emit `REQUIRED_LINEAR_MUTATIONS` with exact setup changes.

## Required Setup

Report missing `llm-*` workflow labels:

- `llm-refine`
- `llm-ready`
- `llm-active`
- `llm-blocked`
- `llm-review`
- `llm-split`

Report missing `sp-*` Superpowers phase labels:

- `sp-clarify`
- `sp-plan`
- `sp-implement`
- `sp-review`
- `sp-verify`

Report missing component labels, type labels, target teams, and target projects. Component/type/project names are workspace-specific, so propose likely values from live Linear metadata instead of hardcoding stale lists.

## Step Completion Handoff

Report:

- Current phase
- What changed, if this doctor pass repaired or clarified setup
- Evidence from live teams, projects, and labels
- Missing evidence
- Open blocker
- Recommended next step
- Recommended next skill

Ask if there is anything else to add for this setup step. If yes, continue the current step by checking that setup item. If no, recommend moving to the next workflow step, normally `linear-create-issue` for a new issue or `linear-status` for an existing issue.

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

Stop when setup is either ready or the exact `REQUIRED_LINEAR_MUTATIONS` list identifies missing labels/projects/statuses.
