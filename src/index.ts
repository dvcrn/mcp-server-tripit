// Polyfill must be imported first — ESM hoists all static imports, so any
// module referencing `globalThis.File` at init time is covered before it runs.
import "./polyfill.js";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerActivityTools } from "./tools/activities";
import { registerDocumentTools } from "./tools/documents";
import { registerFlightTools } from "./tools/flights";
import { registerHotelTools } from "./tools/hotels";
import { registerTransportTools } from "./tools/transport";
import { registerTripTools } from "./tools/trips";

function createServer(): McpServer {
  const server = new McpServer({
    name: "tripit",
    version: "0.1.0",
  });

  registerTripTools(server);
  registerHotelTools(server);
  registerFlightTools(server);
  registerTransportTools(server);
  registerActivityTools(server);
  registerDocumentTools(server);

  return server;
}

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Failed to start TripIt MCP server:", error);
  process.exit(1);
});
