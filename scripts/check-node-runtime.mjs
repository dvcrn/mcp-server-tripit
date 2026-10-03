import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const isolatedHome = await mkdtemp(join(tmpdir(), "tripit-node-"));
const client = new Client({ name: "node-runtime-check", version: "1.0.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/index.js"],
  cwd: process.cwd(),
  env: { PATH: process.env.PATH ?? "", HOME: isolatedHome },
  stderr: "inherit",
});

try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  assert.ok(tools.some((tool) => tool.name === "tripit_trips_list"));

  // A tool call loads tripit before checking credentials; discovery does not.
  const result = await client.callTool({
    name: "tripit_trips_list",
    arguments: { pageSize: 1, pageNum: 1 },
  });
  assert.equal(result.isError, true);
  assert.deepEqual(result.content, [
    {
      type: "text",
      text: "Missing required environment variable: TRIPIT_USERNAME",
    },
  ]);
  console.log(`PASS: Node ${process.version} initializes MCP and loads TripIt.`);
} finally {
  try {
    await client.close();
  } finally {
    await rm(isolatedHome, { recursive: true, force: true });
  }
}
