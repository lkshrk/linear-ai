# Project Facts

Approved durable facts for the Linear AI workflow project. Keep this file small; add only facts that should
be reused across sessions and agents, with their source.

## Workflow Decisions (v2)

- The workflow state is the Linear status (Backlog, Todo, In Progress, In Review, Blocked, Done, Canceled);
  there are no workflow state labels (`docs/workflow.md`).
- The claim is the assignee or delegate plus In Progress; there is no claim label or claim block.
- The issue description in the eleven-section template (`templates/issue.md`) is the plan, checked by
  `scripts/validate_issue.ts`; there are no plan, status or dashboard comment formats.
- An agent acts only on issues the human names, issues delegated or assigned to the AI app, or issues
  with the opt-in label (default `autopilot`).
- The state model matches nightshift's Linear state spec so manual sessions and nightshift share a
  workspace; `ai-stage:` labels are optional and only for issues meant for nightshift.
- Six skills: intake, refine, implement (including closeout), status (including doctor and v1 migration),
  review, reconcile. Skills are self-contained; there are no separate agent prompt files.
- Agents must not guess; unknowns become questions or accepted unknowns in `## Constraints`.
- Done only when the change is on main, proven by `scripts/verify_closeout.ts`.

## Repository Roles

- `linear-ai` owns the workflow skills and their scripts.
