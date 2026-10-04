---
name: linear-status
description: "Report where a Linear issue stands and what to do next, check whether a workspace is set up for the workflow (doctor), or migrate issues from the linear-ai v1 label workflow. Use when unsure what is next, before first use in a workspace, or when upgrading from v1."
---

# Linear Status

Read `docs/workflow.md`. All modes are read-only unless the human explicitly approves the listed changes.

## Issue Mode (default)

Determine the phase from the issue's actual state, not from memory:

| Status and evidence | Phase | Next skill |
|---|---|---|
| no issue yet | intake | `linear-intake` |
| Backlog, or the description fails `scripts/validate_issue.ts` | refine | `linear-refine` |
| Todo and the description is valid | implement | `linear-implement` |
| In Progress, recently updated | in progress (claimed by the assignee or delegate) | none; report who holds it |
| In Progress, no update beyond the stale threshold | stale claim | `linear-implement` (takes over with a comment) |
| Blocked | blocked; quote the latest `<!-- linear-ai:blocked -->` comment | answer the question, then `linear-refine` or `linear-implement` |
| In Review | review handoff; check whether the PR is merged | `linear-implement` (close) once merged |
| Done without a `<!-- linear-ai:closed -->` comment | unverified close | `linear-implement` (close) |
| delegated to nightshift or carrying its opt-in label | nightshift owns it | none |

Report contradictions (Todo with an invalid description, Done with an open PR, an issue still carrying v1
`llm-*` or `in-use` labels) and the smallest repair.

## Doctor Mode

Check a workspace before first use, from live data (`list_teams`, `list_projects`, `list_issue_labels`):

- every team in scope has the statuses Backlog, Todo, In Progress, In Review, Blocked (type started), Done,
  Canceled; report missing ones and that Blocked has to be added in the team's workflow settings;
- the opt-in label exists (default `autopilot`) if the human uses one;
- type labels exist (`bug`, `feature` or a Type group);
- leftover v1 labels (`llm-*`, `in-use`, `sp-*`, `nontechnical-intake`) and how many open issues still carry
  them; recommend Migrate Mode.

Propose fixes; apply only the ones the human approves.

## Migrate Mode (from v1)

v1 kept the workflow state in labels. Map each open issue carrying them and show the plan first:

| v1 label | v2 |
|---|---|
| `llm-refine` | Backlog |
| `llm-ready` | Todo if the description passes `scripts/validate_issue.ts`, otherwise Backlog (needs `linear-refine`) |
| `llm-active` | In Progress, assignee kept |
| `llm-blocked` | Blocked |
| `llm-review` | In Review |
| `in-use` + claim block | removed; the assignee is the claim |
| `nontechnical-intake` | removed; post a `<!-- linear-ai:intake-nontech -->` comment |
| `sp-*` | removed |

- The newest v1 plan comment's content moves into the description's template sections when the issue goes
  to Todo; if that is not possible mechanically, the issue goes to Backlog for `linear-refine`.
- Dashboard and claim blocks are removed from the description; plan and status comments stay as history.
- Only after every open issue is migrated, the v1 labels are archived (not deleted) with the human's
  approval.

Show the full list of planned changes per issue, wait for approval, then apply them and report what was
done. If Linear write tools are unavailable, print the list for the human to apply.

## Handoff

Finish with: the phase or findings, evidence, the smallest repair, and the recommended next skill. Ask
whether the human wants to continue with it; do not run it automatically.
