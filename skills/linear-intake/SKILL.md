---
name: linear-intake
description: "Turn a rough bug report, feature idea, copied draft or a non-technical person's report into a Linear issue in Backlog, routed to the right team and project with fitting labels. Use when someone wants to file, ingest or clean up an issue before refinement."
---

# Linear Intake

Read `docs/workflow.md` (state and labels) and `templates/forms.md` (the forms people file).

Intake creates or cleans up an issue in **Backlog**. It does not diagnose root causes or plan the
implementation; that is `linear-refine`.

## Routing And Labels

1. Read the live teams, projects and labels from Linear (`list_teams`, `list_projects`,
   `list_issue_labels`). Never use a hardcoded list.
2. Propose the target team, project, type label (`bug`, `feature` or the workspace's Type group) and any
   other fitting labels from that live data; ask whether to add more before saving.
3. When the project spans several repositories, set the `repo:<name>` label for the one the issue changes;
   ask if it is unclear.
4. Set the opt-in label (default `autopilot`) only when the human wants an AI agent or nightshift to pick
   the issue up later.

## Technical Mode (default)

Write the description in the form for its type (`templates/forms.md`: Feature, Bug or Improvements), one
`##` heading per field, and fill every required field from the report; ask for what is missing. An issue
already filed through a Linear form only needs its gaps filled. Check whether a similar issue already
exists and offer to link it as related or duplicate instead of creating a new one.

Write the agent format (`templates/issue.md`) directly only when the human hands over an
implementation-ready plan; then validate it as `linear-refine` step 5 does.

## Non-Technical Mode

Use it when the person reporting is not technical, or when asked.

- Ask one plain-language question at a time; avoid technical words unless they use them; accept "I don't
  know".
- Cover: what happened or should change, what they expected, who or what is affected, how often or how
  important, steps or examples, evidence (screenshots, recordings, error messages, links), workaround,
  and what success looks like.
- For UI problems and errors, strongly encourage screenshots or recordings.
- Capture their words faithfully. Do not ask them about code, root causes or tests.

Put the report into the Bug or Feature form (`templates/forms.md`): what happened, expected or desired
outcome, steps, evidence as their fields; who is affected, impact, frequency and workaround go into
`Context`. Post one comment ending in `<!-- linear-ai:intake-nontech -->` so `linear-refine` knows
the issue needs technical translation. If routing is unclear, ask a plain question such as "Which product
or team should see this?".

## Save

Create or update the issue with the final team, project, labels and description in Backlog. If Linear write
tools are unavailable, print the exact team, project, labels and description for the human to apply.

## Handoff

Finish with: the issue link, team, project and labels, and the recommended next skill (normally
`linear-refine`). Ask whether the human wants to continue with it; do not run it automatically.
