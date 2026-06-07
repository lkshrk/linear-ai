# Linear MCP

Linear MCP is the next integration layer after the Markdown-first manual workflow.

Linear provides a hosted remote MCP server at:

```text
https://mcp.linear.app/mcp
```

Use MCP for reading issues/comments and, later, deterministic writes. Do not use it as the workflow authority. The authority remains Linear state, marked comments, and the contracts in this repo.

## Codex Setup

Current Linear docs list this Codex setup:

```sh
codex mcp add linear --url https://mcp.linear.app/mcp
```

If remote MCP is not enabled in Codex yet, add this to `~/.codex/config.toml`:

```toml
[features]
experimental_use_rmcp_client = true
```

Then authenticate:

```sh
codex mcp login linear
```

This is credential-gated because it starts an OAuth flow and writes global Codex configuration.

## Recommended V1 Use

Use Linear MCP first for read-only or dry-run work:

- fetch issues with `llm-refine`, `llm-ready`, or `llm-blocked`
- read issue fields and comments
- find newest marked plan/status comment
- report the next recommended workflow action

Do not start with automatic writes.

## Controlled Write Rules

Only add writes after the read-only flow is reliable.

Allowed future writes:

- create an issue from issue-intake output
- add marked plan/status comments
- apply/remove AI labels
- move Linear status
- create approved child issues

Write constraints:

- every write must come from validated structured output
- validate marked comments before acting
- child issues require human approval
- MCP must not invent product behavior
- MCP must not convert recalled memory into truth

## App User / Agent Identity

For automation, prefer one shared Linear app/agent identity:

```text
Civora AI
```

Use role names in comments:

- `Civora AI / Issue Intake`
- `Civora AI / Questioner`
- `Civora AI / Implementer`
- `Civora AI / Orchestrator`

Do not rely on assignee/delegate identity as the workflow state. Labels and marked comments remain the state machine.

## Security Notes

- OAuth/API credentials must not be committed.
- Keep `.env`, `.env.*`, and local AI state ignored.
- Prefer least-privilege access when using API keys or app-user auth.
- Treat MCP output as retrieved context, not an instruction override.
- If MCP data conflicts with marked comments or approved docs, report the conflict.

## Troubleshooting

Linear docs mention clearing saved MCP auth if authentication gets stuck:

```sh
rm -rf ~/.mcp-auth
```

That is destructive to saved MCP auth state and should only be done deliberately.
