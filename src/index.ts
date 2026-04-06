// Node.js v18 does not expose `File` as a global; polyfill it so bundled packages (e.g. undici inside tripit) can find it.
import { File as NodeFetchFile } from "node-fetch";
if (typeof globalThis.File === "undefined") {
  (globalThis as unknown as Record<string, unknown>).File = NodeFetchFile;
}

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
