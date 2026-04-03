import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function jsonResult(data: Record<string, unknown>): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2),
      },
    ],
    structuredContent: data,
  };
}
