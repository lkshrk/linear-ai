# Workflow

Linear AI uses Linear's own fields as the workflow state. There are no workflow state labels, no claim
labels and no plan or dashboard comment formats. The rules below are the same state model as nightshift's
(nightshift's Linear state spec), so manual sessions and nightshift can work the same
workspace.

## Ticket Reference Rule

Whenever an agent switches focus to an issue it names the issue ID, the exact title and a one-line
description.

## Scope

An agent acts on an issue only when one of these holds:

- the human names it (ID or link) in the session;
- it is delegated or assigned to the AI app user;
- it carries the opt-in label (default `autopilot`; a workspace may use another name).

Batch skills discover work only through the last two. Without a team and project already clear from the
session, a skill asks which team and project to handle before discovering issues.

**Nightshift coexistence:** if nightshift runs on the workspace, an issue in In Progress that is delegated
to nightshift or carries its opt-in label belongs to nightshift. Do not change its status or `ai-*`
labels; to take over, remove the opt-in first.

## State

The status is the state. One mapping for every team:

| Status | Meaning | Who moves it here |
|---|---|---|
| Backlog | needs refinement (description not yet a valid issue) | intake |
| Todo | ready: the description passes `scripts/validate_issue.ts` | refine |
| In Progress | someone is working on it; the assignee or delegate owns it | implement |
| In Review | change handed off for review (PR open or branch ready) | implement |
| Blocked | needs a human decision or an external change; a comment says why | any skill |
| Done | the change is on the main branch, proven by `scripts/verify_closeout.ts` | implement |
| Canceled | dropped | human |

- A team without a Blocked status gets one (type started); `linear-status` in doctor mode reports it.
- There is no separate Triage status; new work starts in Backlog.
- A closing magic word (`Fixes ABC-123`) may move an issue to Done automatically; the implement skill
  still verifies the evidence and posts the closeout comment.

## Claiming

- Before working, the agent sets the assignee (human session) or delegate (AI app) and moves the issue to
  In Progress. That is the claim.
- An issue already In Progress and updated by someone else within the stale threshold (default 60
  minutes) is skipped and reported.
- An issue In Progress with no update beyond the threshold may be reclaimed; the agent posts one comment
  saying it took over.
- Releasing a claim means moving the issue to its next status (In Review, Blocked, Backlog).

## The Issue Is The Plan

Two shapes, two audiences:

- **Forms for people** (`templates/forms.md`): the Linear templates Feature, Bug and Improvements. Short
  fields; an issue in this shape stays in Backlog.
- **The agent format** (`templates/issue.md`, the Linear template "Agent task"): eleven `##` sections from
  Goal to Verify, each heading optionally followed by a hint in parentheses. Refinement translates a form
  into it (mapping in `templates/forms.md`) or fills it directly; there is no separate plan comment.

`scripts/validate_issue.ts FILE` checks an agent-format description and prints every problem. An issue
moves to Todo only when it passes.

Questions during refinement are comments that mention the human; answers are folded back into the
description.

## Labels

- Type labels (`bug`, `feature`, or the workspace's Type group) classify the issue; they do not drive the
  workflow.
- `ai-stage:<stage>` is optional. Set it only when the issue is meant to continue in nightshift later
  (e.g. `ai-stage:implementation` for a refined task).
- No other workflow labels.

## Comments

One comment per milestone, each ending with a hidden marker so a rerun does not post it twice:

| Milestone | Marker | Content |
|---|---|---|
| refined | `<!-- linear-ai:refined -->` | what was clarified; issue now in Todo |
| blocked | `<!-- linear-ai:blocked -->` | the question or missing authority, mentioning the human |
| handoff | `<!-- linear-ai:handoff -->` | PR or branch, verification commands and results |
| closed | `<!-- linear-ai:closed -->` | the closeout evidence (merge commit on main, CI) |
| takeover | `<!-- linear-ai:takeover -->` | a stale claim was taken over |
| reconciled | `<!-- linear-ai:reconciled -->` | repository evidence and the change `linear-reconcile` made |
| intake (plain language) | `<!-- linear-ai:intake-nontech -->` | marks a non-technical report for technical translation |

## Implementation Rules

- Work happens in `<repo>/.worktrees/<issue-id>[-suffix]`, never in a branch's own checkout, `main` or
  `master`.
- At most five review rounds by default, each followed by a short round summary in the session.
- Integration: rebase onto the local main branch, squash to the minimal reviewable commits, integrate into
  main (or open a PR when the repository requires one).
- Done only when the change is on main. An open PR is handoff evidence, not completion.

## Splitting And Parents

- An issue too large for one worktree session is split into child issues; each child gets its own valid
  description. The parent stays as the container and is Done when all children are.
- Larger features use a Linear project (or a parent issue in workspaces without projects); the old `EPIC`
  label is not used.

## Repository Boundaries

An issue names its repository (project mapping or a `repo` note in the description). A change that needs a
second repository gets its own issue there, linked with `blocks` or `related`.
