import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { withTripIt } from "../client";
import { jsonResult } from "../results";
import { requireExactlyOneSelector } from "./common";

const objectTypeSchema = z.enum(["lodging", "activity", "air", "transport"]);

export function registerDocumentTools(server: McpServer): void {
  server.registerTool(
    "tripit_documents_attach",
    {
      title: "TripIt Documents Attach",
      description: "Attach a document to a TripIt object. Type can be omitted and will be auto-detected.",
      inputSchema: {
        id: z.string().min(1).describe("Object UUID to attach to."),
        type: objectTypeSchema.optional().describe("TripIt object type. Optional; auto-detected when omitted."),
        file: z.string().min(1).describe("Path to a local image or PDF file."),
        caption: z.string().optional().describe("Optional caption for the attached document."),
        mimeType: z.string().optional().describe("Optional MIME type override."),
      },
    },
    async ({ id, type, file, caption, mimeType }) =>
      jsonResult(
        (await withTripIt((client) =>
          client.attachDocument({
            objectType: type,
            objectId: id,
            filePath: file,
            caption,
            mimeType,
          }),
        )) as Record<string, unknown>,
      ),
  );

  server.registerTool(
    "tripit_documents_remove",
    {
      title: "TripIt Documents Remove",
      description: "Remove a document from a TripIt object. Type can be omitted and will be auto-detected.",
      inputSchema: {
        id: z.string().min(1).describe("Object UUID to remove the document from."),
        type: objectTypeSchema.optional().describe("TripIt object type. Optional; auto-detected when omitted."),
        imageUuid: z.string().optional().describe("UUID of the image to remove."),
        imageUrl: z.string().optional().describe("URL of the image to remove."),
        caption: z.string().optional().describe("Caption of the image to remove."),
        index: z.number().int().positive().optional().describe("1-based image index to remove."),
        all: z.boolean().optional().describe("When true, remove all documents."),
      },
      annotations: {
        destructiveHint: true,
      },
    },
    async ({ id, type, imageUuid, imageUrl, caption, index, all }) => {
      requireExactlyOneSelector(
        [Boolean(imageUuid), Boolean(imageUrl), Boolean(caption), index !== undefined, Boolean(all)],
        "Provide exactly one selector: imageUuid, imageUrl, caption, index, or all.",
      );

      return jsonResult(
        (await withTripIt((client) =>
          client.removeDocument({
            objectType: type,
            objectId: id,
            imageUuid,
            imageUrl,
            caption,
            index,
            removeAll: all,
          }),
        )) as Record<string, unknown>,
      );
    },
  );
}
