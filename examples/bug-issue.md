# Example Bug Issue

```markdown
# Login redirects to blank page after successful password entry

## Problem

Users can enter valid credentials but cannot reach the app because the post-login redirect lands on a blank page.

## Expected Behavior

After successful login, the user should land on the dashboard.

## Actual Behavior

After submitting valid credentials, the browser navigates to `/auth/callback` and renders a blank page.

## Reproduction Steps

1. Open the production web app.
2. Log in with a valid user account.
3. Submit the password form.
4. Observe that the browser shows a blank `/auth/callback` page.

## Context

- Page/area: login flow
- Environment: production
- Account/tenant: example tenant
- Build/version/branch: unknown
- Feature flags/config: unknown
- Related repos: web, backend

## Evidence / Links

- Screenshot: attached in Linear
- Browser console log: attached in Linear
```

Recommended labels:

- `bug`
- `llm-refine`
