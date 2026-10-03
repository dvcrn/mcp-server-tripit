import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { isWrongType, tripitGet, tripitReplace, theObject, withLockedObject } from "../api";
import { type TripItClient, withTripIt } from "../client";
import { type ImageSelector, mergeReplace, remainingImages } from "../payloads";
import { jsonResult } from "../results";
import { requireExactlyOneSelector } from "./common";

const objectTypeSchema = z.enum(["lodging", "activity", "air", "transport"]);
// Removal also knows cars, which the tripit library does not. Hotels and cars are done here by
// read, filter, replace (../payloads): the library's removal rewrites a hotel through its own
// updateHotel, which wipes the confirmation number, phone, rate, notes and cost (seen live,
// 2026-10-02).
const removeTypeSchema = z.enum(["lodging", "activity", "air", "transport", "car"]);
const OWN: Record<"lodging" | "car", string> = { lodging: "LodgingObject", car: "CarObject" };

export async function removeOwn(client: TripItClient, type: "lodging" | "car", id: string, sel: ImageSelector) {
  return withLockedObject(client, type, OWN[type], id, async (existing) => {
    const rest = remainingImages(existing.Image, sel);
    const image = rest.length === 0 ? null : rest.length === 1 ? rest[0] : rest;
    return tripitReplace(client, type, String(existing.uuid), OWN[type], mergeReplace(type, existing, { Image: image }));
  });
}

/** lodging or car when the id is one, else undefined (the library then detects the rest). Only a
 * "not this type" answer moves on: a transient failure looking up a hotel must not fall through to
 * the library, whose hotel path wipes fields. */
async function ownType(client: TripItClient, id: string): Promise<"lodging" | "car" | undefined> {
  for (const type of ["lodging", "car"] as const) {
    try {
      theObject(await tripitGet(client, type, id), OWN[type], id);
      return type;
    } catch (err) {
      if (!isWrongType(err)) throw err;
    }
  }
  return undefined;
}

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
        type: removeTypeSchema
          .optional()
          .describe("TripIt object type. Optional; auto-detected when omitted."),
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

      const sel: ImageSelector = { uuid: imageUuid, url: imageUrl, caption, index, all };
      return jsonResult(
        (await withTripIt(async (client) => {
          const own = type === "lodging" || type === "car" ? type : type ? undefined : await ownType(client, id);
          if (own) return removeOwn(client, own, id, sel);
          return client.removeDocument({
            objectType: type as "activity" | "air" | "transport" | undefined,
            objectId: id,
            imageUuid,
            imageUrl,
            caption,
            index,
            removeAll: all,
          });
        })) as Record<string, unknown>,
      );
    },
  );
}
