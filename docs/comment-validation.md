# Comment Validation

Use this checklist before an agent or orchestrator acts on a marked Linear comment.

For local validation, use `scripts/validate_marked_comments.ts`. This checklist remains the human-readable policy.

## Plan Comment

A plan comment is valid only when:

- it starts with `<!-- linear-ai:plan v1 ... -->`
- it ends with `<!-- /linear-ai:plan -->`
- it contains fenced YAML
- the YAML matches `schemas/linear-ai.plan.v1.schema.yaml`
- `schema` is `linear-ai.plan.v1`
- `issue_id` matches the Linear issue
- `revision` is present
- `plan_status` is `draft`, `ready`, or `blocked`
- `target_repositories` is present
- `implementation_checklist` is present
- `acceptance_criteria` is present
- `verification` is present
- YAML and Markdown do not contradict each other

Implementation can start only when:

- `plan_status: ready`
- `open_questions` is empty, or every item is explicitly listed in `accepted_unknowns`
- `do_not_assume` is present

## Status Comment

A status comment is valid only when:

- it starts with `<!-- linear-ai:status v1 ... -->`
- it ends with `<!-- /linear-ai:status -->`
- it contains fenced YAML
- the YAML matches `schemas/linear-ai.status.v1.schema.yaml`
- `schema` is `linear-ai.status.v1`
- `issue_id` matches the Linear issue
- `plan_revision` points to the plan being implemented
- `status_revision` is present
- `implementation_status` is `active`, `blocked`, `review_ready`, or `abandoned`
- `verification` is present
- YAML and Markdown do not contradict each other

Review handoff can start only when:

- `implementation_status: review_ready`
- draft PR links are present
- unresolved blocking questions are absent
- placeholders are absent or explicitly accepted
- verification is passing or gaps are explicitly accepted

## Failure Rule

If validation fails, do not infer intent from surrounding prose. Ask for a corrected comment or have the responsible agent regenerate it.
