# mcp-server-tripit

`mcp-server-tripit` exposes the TripIt API as an MCP server.

It is built on top of the [`tripit-cli`](https://github.com/dvcrn/tripit-cli) project and uses the [`tripit`](https://www.npmjs.com/package/tripit) package to access the full TripIt API.

Deploy this server directly to [MCP Nest](https://mcpnest.dev)

<a href="https://mcpnest.dev/deploy?server=mcp-server-tripit&package-manager=npx&env[TRIPIT_USERNAME]=&env[TRIPIT_PASSWORD]=">
    <img src="https://mcpnest.dev/images/deploy-on-mcpnest.png" alt="Deploy on MCP Nest" height="32" />
  </a>

## Install

Run it directly with:

```bash
npx -y mcp-server-tripit
```

## Usage with Claude

Add it to your MCP configuration:

```json
{
  "mcpServers": {
    "tripit": {
      "command": "npx",
      "args": ["-y", "mcp-server-tripit"],
      "env": {
        "TRIPIT_USERNAME": "your-tripit-username",
        "TRIPIT_PASSWORD": "your-tripit-password"
      }
    }
  }
}
```

If you want to supply the optional client id too:

```json
{
  "mcpServers": {
    "tripit": {
      "command": "npx",
      "args": ["-y", "mcp-server-tripit"],
      "env": {
        "TRIPIT_USERNAME": "your-tripit-username",
        "TRIPIT_PASSWORD": "your-tripit-password",
        "TRIPIT_CLIENT_ID": "your-tripit-client-id"
      }
    }
  }
}
```

## Configuration

The server reads TripIt credentials from environment variables:

Required:

- `TRIPIT_USERNAME`
- `TRIPIT_PASSWORD`

Optional:

- `TRIPIT_CLIENT_ID`

If `TRIPIT_CLIENT_ID` is set, it is passed through to the `tripit` client. If it is omitted, the server does not pass it.

If you use `fnox`, you can also run it like this:

```bash
fnox x -- npx -y mcp-server-tripit
```

## What it can do

Built on top of [`dvcrn/tripit-cli`](https://github.com/dvcrn/tripit-cli), this MCP server exposes the TripIt API for common travel workflows, including:

- listing and fetching trips
- creating, updating, and deleting trips
- managing hotel reservations
- managing flights
- managing transport segments
- managing activities
- attaching and removing documents from supported TripIt objects

## Car rentals and preserving reservation fields

Use `tripit_cars_get`, `tripit_cars_create`, `tripit_cars_update` and
`tripit_cars_delete`. Generic document tools also accept `type: "car"` and support
car auto-detection. Hotel updates accept `phone` and `displayName`; car updates
accept `displayName`.

Hotel/car edits preserve omitted fields, custom names and attachments. Empty
strings leave existing values unchanged; `null` explicitly clears a field. Trip
association cannot be cleared. Unknown returned fields cause the library to reject
an update rather than lose data. The library serializes hotel/car edits and document
changes within one process. Edits in another process or the TripIt app can still
race.

Car support builds on [John P White (@diverdown1964)'s PR #2](https://github.com/dvcrn/mcp-server-tripit/pull/2).
