# Linear Non-Technical Intake Skill Design

## Goal

Create a `linear-nontech-intake` skill for interviewing non-technical people directly and turning their answers into useful Linear issues.

The skill creates an issue immediately after collecting enough plain-language facts. It does not create a ready implementation plan. The issue is deliberately marked for technical refinement.

## Users

Primary user: a non-technical person reporting a problem, request, confusion, or desired outcome.

Secondary user: a technical reviewer or agent that later runs `linear-refine` to translate the raw issue into technical scope, acceptance criteria, and implementation plan.

## Skill Contract

The skill must:

- Ask one plain-language question at a time.
- Avoid technical vocabulary unless the user volunteers it.
- Collect enough facts to create a useful issue, not enough to design the solution.
- Create the Linear issue directly.
- Determine target team and project from Linear metadata or plain-language user choice.
- Apply `llm-refine`.
- Apply `nontechnical-intake`.
- Apply an obvious type label such as `bug` or `feature` when Linear metadata supports it.
- Leave type classification unresolved when the type is unclear.
- Make technical gaps explicit in the issue body.

The skill must not:

- Claim the issue is ready for implementation.
- Invent affected systems, root causes, code paths, or test plans.
- Force non-technical users to answer technical questions.
- Block issue creation only because technical details are missing.

## Interview Flow

The interview asks enough questions to fill the issue body:

1. What happened or what do you want to change?
2. What did you expect instead?
3. Who or what is affected?
4. How often does it happen, or how important is it?
5. What steps, context, or examples help show the situation?
6. Do you have screenshots, screen recordings, error messages, links, affected records, customer examples, Slack/email context, or comparable examples?
7. Is there a workaround?
8. What would success look like in plain language?

Screenshots and other evidence are optional, but the skill should ask for them explicitly. For UI bugs, visual confusion, or error reports, it should strongly encourage screenshots or recordings. For feature requests, it should ask for examples, references, or comparable behavior instead.

## Linear Issue Shape

The created issue body should use these sections:

- Summary
- What happened
- Expected outcome
- Who/what is affected
- Impact / urgency
- Steps or context
- Evidence / links
- Known workaround
- Desired success
- Non-technical intake notes
- Technical triage gaps

`Evidence / links` can include screenshots, screen recordings, error messages, URLs, affected records/items, customer/user examples, Slack/email context, or comparable examples.

`Technical triage gaps` should state that these are unknown until a technical reviewer or `linear-refine` fills them in:

- affected system or code area
- root cause
- implementation approach
- technical acceptance criteria
- test strategy

## Linear Routing And Labels

Before creating the issue, the skill should inspect available Linear teams, projects, statuses, and labels. It should ask the non-technical user for a plain-language routing choice only when metadata does not make the target obvious.

The skill should not expose raw Linear configuration unless needed. Prefer questions like "Which product or team should see this?" over "Which Linear team ID should I use?"

If `nontechnical-intake` does not exist and the agent has permission to create labels, the skill should create it. If label creation is unavailable, the skill should create the issue with `llm-refine` and include a clear note in the issue body that the `nontechnical-intake` marker label could not be applied.

## Label Semantics

`nontechnical-intake` means the issue came from a non-technical interview and needs technical translation before planning.

It does not merely mean "technical details are missing"; most `llm-refine` issues are missing some detail. The label specifically tells downstream agents to preserve the user-language facts and convert them into technical scope.

`linear-refine` should treat `nontechnical-intake` as a refinement hint:

- preserve the original plain-language report
- identify affected systems from repo and Linear context
- convert desired success into testable acceptance criteria
- fill or replace `Technical triage gaps`
- remove `nontechnical-intake` only after technical triage is complete

## Error Handling

If Linear metadata is unavailable, the skill should explain the missing access and produce a copyable draft issue body instead of inventing labels.

If the user cannot answer a question, the skill should record "unknown" or "not provided" and continue when enough information exists to create the issue.

If the report appears urgent or production-impacting, the skill should capture impact clearly but still avoid assigning a technical cause.

## Acceptance Criteria

- A non-technical user can answer the interview without understanding implementation details.
- The skill creates a Linear issue directly when Linear access is available.
- The skill determines target team/project from metadata or plain-language routing.
- The issue is labeled `llm-refine` and `nontechnical-intake`.
- The issue contains optional evidence prompts, including screenshots and recordings.
- The issue clearly separates user facts from technical unknowns.
- Downstream `linear-refine` can detect the marker label and know technical triage is required.

## Out of Scope

- Implementing the issue.
- Producing an implementation plan.
- Diagnosing root cause.
- Choosing code ownership or affected files.
- Creating a new UI form.
- Replacing `linear-create-issue` for technical operators.
