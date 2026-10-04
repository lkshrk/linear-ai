# Issue forms

People file issues with one of three short Linear forms. Agents never dispatch a form; `linear-refine`
turns it into the agent format (`templates/issue.md`, the Linear template "Agent task").

| Form | Fields (* required) |
|---|---|
| Feature | Problem / Opportunity*, Desired outcome*, Context*, Evidence / Links |
| Bug | What happened*, Expected*, Steps to reproduce*, Context*, Evidence / Links |
| Improvements | Problem / Opportunity*, Current behavior, Context*, Evidence / Links |

`Context` names the repository or product area, the environment, constraints and deadlines.

## Mapping into the agent format

| Agent section | Comes from |
|---|---|
| Goal | Desired outcome (Feature); "Make <area> behave as Expected" (Bug); Problem / Opportunity restated as the change (Improvements) |
| Why | the original report: every filled form field as a bold label with its text, unchanged |
| Design excerpt | the project's design document if one exists; otherwise `none` |
| Files | found from Context and the code |
| Constraints | constraints and deadlines from Context |
| Acceptance criteria | Desired outcome or Expected, rewritten as checkable items |
| Tests expected | for a Bug, a regression test that follows Steps to reproduce and fails before the fix |
| Verify | the repository's check commands |

Form fields never stay as their own `##` headings in a refined issue: the validator rejects unknown
sections, so the report lives under `## Why`.
