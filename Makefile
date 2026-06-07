.PHONY: test validate render-examples metadata-summary self-review install-smoke

test:
	bun test

validate:
	bun scripts/validate_marked_comments.ts templates/linear-plan-comment.md templates/linear-status-comment.md examples/plan-comment.md examples/status-comment.md

render-examples:
	bun scripts/render_issue.ts examples/bug-input.yaml
	bun scripts/render_issue.ts examples/feature-input.yaml

metadata-summary:
	bun scripts/linear_metadata.ts summary --metadata examples/linear-metadata.json

self-review:
	bun scripts/self_review.ts

install-smoke:
	bun scripts/install_smoke.ts
