import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ALL_TOOL_NAMES } from "../src/types";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const isolatedHome = await mkdtemp(join(tmpdir(), "tripit-offline-"));
const client = new Client({ name: "offline-discovery", version: "1.0.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["run", "dist/index.js"],
  cwd: process.cwd(),
  env: { PATH: process.env.PATH ?? "", HOME: isolatedHome },
  stderr: "inherit",
});
try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  const actual = new Set(tools.map((tool) => tool.name));
  if (
    actual.size !== ALL_TOOL_NAMES.length ||
    ALL_TOOL_NAMES.some((name) => !actual.has(name))
  ) {
    throw new Error("Tool discovery does not match ALL_TOOL_NAMES");
  }
  console.log(
    `PASS: MCP initialization and discovery of all ${actual.size} expected tools; no tool calls.`,
  );
} finally {
  await client.close();
  await rm(isolatedHome, { recursive: true, force: true });
}
