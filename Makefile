.PHONY: test validate render-examples metadata-summary marketplace-generate marketplace-publish marketplace-smoke release-check release-create verify-handoff self-review install-smoke skills-smoke

test:
	bun test

validate:
	bun scripts/validate_marked_comments.ts templates/linear-plan-comment.md templates/linear-status-comment.md templates/linear-dashboard-comment.md examples/plan-comment.md examples/status-comment.md examples/dashboard-comment.md examples/review-ready-status-comment.md examples/review-ready-dashboard-comment.md

render-examples:
	bun scripts/render_issue.ts examples/bug-input.yaml
	bun scripts/render_issue.ts examples/feature-input.yaml

metadata-summary:
	bun scripts/linear_metadata.ts summary --metadata examples/linear-metadata.json

marketplace-generate:
	bun scripts/generate_marketplace_specs.ts --version package

marketplace-publish:
	bun scripts/publish_marketplace.ts $(if $(PUSH),--push,)

marketplace-smoke:
	bun scripts/marketplace_smoke.ts

release-check: marketplace-generate
	bun scripts/verify_release.ts --marketplace-dir dist/marketplace

release-create:
	bun scripts/create_release.ts $(VERSION)

verify-handoff:
	bun scripts/verify_handoff.ts --issue-id CIV-999 --status examples/review-ready-status-comment.md --dashboard examples/review-ready-dashboard-comment.md

self-review:
	bun scripts/self_review.ts

install-smoke:
	bun scripts/install_smoke.ts

skills-smoke:
	bun scripts/skills_smoke.ts
