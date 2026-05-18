- Repo: dvcrn/mcp-server-tripit

# Development Notes

## Package Manager

- Use `bun` for this repository. The repo has `bun.lock` and existing package scripts in `package.json`.
- Do not edit `package.json` directly for dependency changes; use the package manager.

## Secrets

- TripIt credentials are managed with `fnox`.
- Required live-test secrets are `TRIPIT_USERNAME` and `TRIPIT_PASSWORD`.
- `TRIPIT_CLIENT_ID` is optional.
- Run commands that need credentials through `fnox x -- ...`.

## MCP Testing

### Static Checks

Run TypeScript checks and build before testing MCP behavior:

```bash
bun run check
bun run build
```

### Protocol Handshake And Tool Listing

This verifies the built stdio MCP server starts correctly and exposes its tools. It does not call TripIt and does not require TripIt credentials:

```bash
bun run build
npx -y @modelcontextprotocol/inspector --cli bun run dist/index.js --method tools/list
```

Expected result: the command returns the registered `tripit_*` tools.

### Read-Only Live TripIt Test

This verifies end-to-end MCP transport, TripIt authentication, and a read-only API call:

```bash
fnox x -- npx -y @modelcontextprotocol/inspector --cli bun run dist/index.js \
  --method tools/call \
  --tool-name tripit_trips_list \
  --tool-arg pageSize=1 \
  --tool-arg pageNum=1
```

Expected result: the command returns a TripIt response with `page_size` set to `1` and trip/profile data for the authenticated account.

### Full Mutating Smoke Test

The repo has a full smoke test in `scripts/smoke-test.ts`:

```bash
bun run build
fnox x -- bun run smoke
```

This creates a temporary TripIt trip plus hotel, flight, transport, and activity objects, verifies they can be fetched, then attempts to delete them in cleanup. Treat this as a mutating integration test.

### Interactive Inspector

For manual tool exploration in the MCP Inspector UI:

```bash
fnox x -- npx -y @modelcontextprotocol/inspector bun run dist/index.js
```

Open the Inspector URL printed by the command, connect to the stdio server, and use the Tools tab to inspect schemas or call individual tools.

## Git Practices

- Never use `git stash`, `git checkout .`, `git reset --hard`, `git clean`, or commands that discard uncommitted work.
- Never use `git add .` or `git add -A`; stage specific files only.
- Do not include assistant/tool attribution in commit messages.
