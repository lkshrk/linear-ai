---
name: linear-nontech-intake
description: "Interview non-technical people directly and create Linear issues from plain-language reports, requests, confusion, screenshots, screen recordings, error messages, links, examples, or desired outcomes. Use when a non-technical user needs help filing a Linear issue that should enter `llm-refine` with a `nontechnical-intake` marker because technical triage is still required."
---

# Linear Non-Technical Intake

Interview the user directly. Use plain language, ask one question at a time, and create a Linear issue after collecting enough facts.

This skill creates a useful raw issue. It does not create an implementation-ready issue, diagnose root cause, choose affected code, or produce a technical plan.

## Interview Rules

- Ask one plain-language question at a time.
- Avoid technical vocabulary unless the user volunteers it.
- Accept "I don't know" and continue when enough information exists.
- Do not ask the user to identify code, systems, root cause, implementation approach, or test strategy.
- Prefer a short issue over blocking on technical detail.
- Capture the user's words faithfully.

## Interview Flow

Ask enough questions to fill the issue body:

1. What happened, or what do you want to change?
2. What did you expect instead?
3. Who or what is affected?
4. How often does it happen, or how important is it?
5. What steps, context, or examples help show the situation?
6. Do you have screenshots, screen recordings, error messages, links, affected records, customer examples, Slack/email context, or comparable examples?
7. Is there a workaround?
8. What would success look like in plain language?

For UI bugs, visual confusion, or error reports, strongly encourage screenshots or screen recordings. For feature requests, ask for examples, references, or comparable behavior.

## Linear MCP Contract

Use these Linear MCP tools when available:

- `list_teams` - read available Linear teams before choosing target team.
- `list_projects` - read available Linear projects before choosing target project.
- `list_issue_labels` - read available Linear labels before proposing labels.
- `save_issue` - create the Linear issue and apply labels when writes are available.

Live intake sequence:

1. Run `list_teams`, `list_projects`, and `list_issue_labels`.
2. Choose the target team and project from metadata when obvious.
3. If routing is not obvious, ask a plain-language routing question such as "Which product or team should see this?"
4. Apply `llm-refine`.
5. Apply `nontechnical-intake`.
6. Apply an obvious type label such as `bug` or `feature` when Linear metadata supports it.
7. Leave type classification unresolved when unclear.
8. Call `save_issue` with the final issue body and labels.

If Linear MCP read tools or metadata results are unavailable, explain that Linear metadata access is missing. Do not invent team, project, status, or labels. Ask only a plain-language routing question if it would materially improve the draft. Produce a copyable draft issue body and emit `REQUIRED_LINEAR_MUTATIONS` with team, project, status, and labels marked `needs Linear metadata` instead of guessed values.

If `nontechnical-intake` does not exist and a Linear label-creation tool is available, create the label before saving the issue. If label creation is unavailable, save the issue with `llm-refine` and include a note in the issue body that the `nontechnical-intake` marker label could not be applied.

If Linear MCP write tools are unavailable, do not claim the issue was created. Emit `REQUIRED_LINEAR_MUTATIONS` with the exact target team, project, labels, and issue body the human should apply.

## Issue Body

Create the issue body with these sections:

```markdown
## Summary

Write a one-sentence plain-language summary from the interview.

## What happened

Record the user's report in their words.

## Expected outcome

Record what the user expected or wants instead.

## Who/what is affected

Record affected people, customers, records, environments, workflows, or "Unknown."

## Impact / urgency

Record frequency, severity, business impact, deadline, or "Unknown."

## Steps or context

Record steps, context, examples, or "Not provided."

## Evidence / links

Record screenshots, screen recordings, error messages, URLs, affected records/items, customer/user examples, Slack/email context, comparable examples, or "Not provided."

## Known workaround

Record the workaround, or "None known."

## Desired success

Record the plain-language definition of success.

## Non-technical intake notes

This issue was created from a non-technical interview. Preserve the user-language facts during refinement.

## Technical triage gaps

- Affected system or code area: unknown
- Root cause: unknown
- Implementation approach: unknown
- Technical acceptance criteria: needs conversion from desired success
- Test strategy: unknown
```

Do not omit `Technical triage gaps`. It is the handoff surface for `linear-refine`.

## Step Completion Handoff

When the issue is created, report:

- Created issue URL or identifier
- Applied labels
- Missing marker label, if `nontechnical-intake` could not be applied
- Evidence captured
- Technical triage gaps
- Recommended next skill: `linear-refine`

If the issue could not be created, report:

- Why creation failed
- `REQUIRED_LINEAR_MUTATIONS`
- Recommended next step
