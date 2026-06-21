# Linear Setup

Use this checklist to configure Linear so the Markdown workflow can run manually and later be automated.

For a complete setup pass, use [the setup checklist](setup-checklist.md).

## Team

All Linear issues created or managed by this workflow belong to the `Civora` team.

Projects may vary by issue, but agents and automation must not route workflow issues to another Linear team unless this setup contract is updated first.

## Labels

Create these AI workflow labels:

- `llm-refine`
- `llm-ready`
- `llm-active`
- `llm-blocked`
- `llm-review`
- `llm-split`

Create this claim lock label (outside the `llm-*` state machine):

- `in-use`

Create these Superpowers phase labels:

- `sp-clarify`
- `sp-plan`
- `sp-implement`
- `sp-review`
- `sp-verify`

Create or reuse these product labels:

- `bug`
- `feature`

AI labels drive the workflow. Product labels classify the issue.

Only one AI workflow label may be active at a time. When adding one `llm-*` label, remove the other `llm-*` labels.

## Statuses

Use existing statuses where possible. Recommended mapping:

- Intake or Backlog - new issues and `llm-refine`
- Ready - `llm-ready`
- In Progress - `llm-active`
- Blocked - `llm-blocked` when your team uses a blocked status
- In Review - `llm-review`
- Done - merged or accepted work

If a dedicated Blocked status does not exist, keep the normal status unchanged and rely on `llm-blocked`.

## Bug Template

The Linear bug template should contain exactly:

1. `Title`
2. `Problem`
3. `Expected Behavior`
4. `Actual Behavior`
5. `Reproduction Steps`
6. `Context`
7. `Evidence / Links`

Recommended defaults:

- label: `bug`
- priority: unset unless the reporter knows it
- assignee: unset unless a human triage owner is required

## Feature Template

The Linear feature template should contain:

1. `Title`
2. `Problem / Opportunity`
3. `Desired Outcome`
4. `User / Actor`
5. `Current Behavior`
6. `Proposed Behavior`
7. `Context`
8. `Evidence / Links`

Recommended defaults:

- label: `feature`
- priority: unset unless the requester knows it
- assignee: unset unless a human triage owner is required

## Agent Identity

For v1, one shared AI/bot identity is enough if Linear allows it in the workspace.

Recommended display name:

- `Civora AI`

Use role names in comments and PR text:

- Issue Intake
- Questioner
- Implementer
- Orchestrator

Do not rely on assignee identity as the workflow state. Labels and marked comments are the state machine.

## Comment Markers

Agents and future automation should only parse marked comments:

- `<!-- linear-ai:plan v1 ... -->`
- `<!-- /linear-ai:plan -->`
- `<!-- linear-ai:status v1 ... -->`
- `<!-- /linear-ai:status -->`

Unmarked comments are human context only.

## Git Integration

Enable normal Linear Git integration for PR linking and Done transitions where possible.

The workflow does not require Git integration for v1, but it helps:

- connect draft PRs to issues
- make review state visible
- mark issues done after merge

## Free Account Notes

The Markdown-first workflow does not depend on paid Linear automations.

V1 needs only:

- labels
- issue templates
- comments
- priorities
- issue statuses
- manual PR links

Future orchestrator phases may need Linear API/MCP access and should be checked against the current Linear plan before implementation.
