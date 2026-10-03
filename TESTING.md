# Validation

This draft consumes [tripit-js PR #4](https://github.com/dvcrn/tripit-js/pull/4),
commit `3980be219abde64b4e0cdef82bc599fb2851063f`, and follows
[John P White (@diverdown1964)'s PR #2](https://github.com/dvcrn/mcp-server-tripit/pull/2).

Validated with Bun 1.3.10, TypeScript 5.9.3, MCP SDK 1.32.0, Zod 3.25.76 and
tsup 8.5.1. The committed lockfile pins transitive dependencies. A clean
`bun install --frozen-lockfile` from an empty cache successfully fetched and built
the exact Git dependency without a package publication.

Checks:

- `bun run check` and `bun run build` pass.
- `bun test` passes 35 assertions through an in-memory MCP connection using the
  actual pinned library. Covers car/hotel CRUD, argument mapping, partial edits,
  custom names, null clearing, unsupported trip clearing, document preservation,
  attachment, selective/last removal, selector validation and deleted-object errors.
- `bun scripts/discover-tools.ts` launches the built stdio server without
  credentials and discovers all 29 tools.
- The library's 36 offline regressions cover payload ordering, unknown-field
  rejection, both false representations, numeric-ID/UUID locking and concurrent
  edits/attachments in more detail.

On 2026-10-03, `scripts/reservation-integration.ts` passed against the configured
dev account through the built stdio server. Authentication used a fresh isolated
HOME; the returned profile matched the previously verified dev UUID before any
mutation. It verified car/hotel CRUD, unchanged-field comparisons, concurrent
updates, null and empty-string semantics, custom names, PDF attachment,
auto-detection, selective removal and last-document removal. The hotel, car and
parent synthetic trip were deleted and verified absent. Authentication initially
failed because the subprocess lacked proxy settings; the harness now forwards
proxy and CA configuration. That attempt created no objects.

To repeat, provide configured credentials through the configured secret mechanism
and set `TRIPIT_DEV_IDENTITY` to the confirmed dev account email, screen name or UUID:

```sh
tripit_test_home=$(mktemp -d)
fnox x -- env HOME="$tripit_test_home" TRIPIT_LIVE_TEST=1 bun scripts/reservation-integration.ts
```

Remove the temporary HOME afterward. Never commit credentials, token caches or
raw live responses. Integration and cleanup failures fail the run. No live tests
run in CI. Independent review findings were addressed; this remains a draft and
must not be published until its library dependency is merged and released under
separate authorization.
