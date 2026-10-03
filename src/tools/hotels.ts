import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { tripitReplace, withLockedObject } from "../api";
import { withTripIt } from "../client";
import { mergeReplace, normalizeTime } from "../payloads";
import { jsonResult } from "../results";
import { requireExactlyOneSelector } from "./common";
import { removeOwn } from "./documents";

export function registerHotelTools(server: McpServer): void {
  server.registerTool(
    "tripit_hotels_get",
    {
      title: "TripIt Hotels Get",
      description: "Get a hotel reservation by ID or UUID.",
      inputSchema: {
        id: z.string().min(1).describe("Hotel ID or UUID."),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ id }) => jsonResult((await withTripIt((client) => client.getHotel(id))) as Record<string, unknown>),
  );

  server.registerTool(
    "tripit_hotels_create",
    {
      title: "TripIt Hotels Create",
      description: "Add a hotel booking to a trip.",
      inputSchema: {
        trip: z.string().min(1).describe("Trip UUID or Trip ID."),
        name: z.string().min(1).describe("Hotel name."),
        checkin: z.string().min(1).describe("Check-in date in YYYY-MM-DD format."),
        checkout: z.string().min(1).describe("Check-out date in YYYY-MM-DD format."),
        checkinTime: z.string().optional().describe("Check-in time in HH:MM format. Defaults to 15:00."),
        checkoutTime: z.string().optional().describe("Check-out time in HH:MM format. Defaults to 11:00."),
        timezone: z.string().optional().describe("Timezone. Defaults to UTC."),
        address: z.string().min(1).describe("Street address."),
        city: z.string().min(1).describe("City."),
        country: z.string().min(1).describe("Country code such as JP or US."),
        state: z.string().optional().describe("State or province."),
        zip: z.string().optional().describe("Postal code."),
        confirmation: z.string().optional().describe("Confirmation number."),
        rate: z.string().optional().describe("Booking rate."),
        notes: z.string().optional().describe("Notes for the booking."),
        cost: z.string().optional().describe("Total cost."),
      },
    },
    async (args) =>
      jsonResult(
        (await withTripIt((client) =>
          client.createHotel({
            tripId: args.trip,
            hotelName: args.name,
            checkInDate: args.checkin,
            checkInTime: args.checkinTime ?? "15:00",
            checkOutDate: args.checkout,
            checkOutTime: args.checkoutTime ?? "11:00",
            timezone: args.timezone ?? "UTC",
            street: args.address,
            city: args.city,
            country: args.country,
            state: args.state,
            zip: args.zip,
            supplierConfNum: args.confirmation,
            bookingRate: args.rate,
            notes: args.notes,
            totalCost: args.cost,
          }),
        )) as Record<string, unknown>,
      ),
  );

  server.registerTool(
    "tripit_hotels_update",
    {
      title: "TripIt Hotels Update",
      description:
        "Update an existing hotel reservation. Only the fields passed change; everything else on the reservation is kept.",
      inputSchema: {
        id: z.string().min(1).describe("Hotel ID or UUID."),
        trip: z.string().optional().describe("Trip UUID or Trip ID."),
        name: z.string().optional().describe("Hotel name."),
        checkin: z.string().optional().describe("Check-in date in YYYY-MM-DD format."),
        checkout: z.string().optional().describe("Check-out date in YYYY-MM-DD format."),
        checkinTime: z.string().optional().describe("Check-in time in HH:MM format."),
        checkoutTime: z.string().optional().describe("Check-out time in HH:MM format."),
        timezone: z.string().optional().describe("Timezone."),
        address: z.string().optional().describe("Street address."),
        city: z.string().optional().describe("City."),
        country: z.string().optional().describe("Country code such as JP or US."),
        state: z.string().optional().describe("State or province."),
        zip: z.string().optional().describe("Postal code."),
        confirmation: z.string().optional().describe("Confirmation number."),
        rate: z.string().optional().describe("Booking rate."),
        notes: z.string().optional().describe("Notes for the booking."),
        cost: z.string().optional().describe("Total cost."),
        phone: z.string().optional().describe("Hotel phone number."),
      },
    },
    // Read, merge, replace (../payloads): the library's updateHotel sends only the fields passed,
    // and TripIt's replace wipes the rest (confirmation number, phone, address, rate, notes, cost).
    async (args) =>
      jsonResult(
        await withTripIt((client) => withLockedObject(client, "lodging", "LodgingObject", args.id, async (existing) => {
          if (!existing.supplier_name && existing.display_name) existing.supplier_name = existing.display_name;
          const changes: Record<string, unknown> = {
            supplier_name: args.name,
            supplier_conf_num: args.confirmation,
            supplier_phone: args.phone,
            booking_rate: args.rate,
            notes: args.notes,
            total_cost: args.cost,
            StartDateTime: { date: args.checkin, time: normalizeTime(args.checkinTime), timezone: args.timezone },
            EndDateTime: { date: args.checkout, time: normalizeTime(args.checkoutTime), timezone: args.timezone },
            Address: { address: args.address, city: args.city, state: args.state, zip: args.zip, country: args.country },
          };
          if (args.trip) {
            const key = args.trip.includes("-") ? "trip_uuid" : "trip_id";
            changes[key] = args.trip;
            changes[key === "trip_uuid" ? "trip_id" : "trip_uuid"] = null;
          }
          const payload = mergeReplace("lodging", existing, changes);
          return tripitReplace(client, "lodging", String(existing.uuid), "LodgingObject", payload);
        })),
      ),
  );

  server.registerTool(
    "tripit_hotels_delete",
    {
      title: "TripIt Hotels Delete",
      description: "Delete a hotel reservation by ID or UUID.",
      inputSchema: {
        id: z.string().min(1).describe("Hotel ID or UUID."),
      },
      annotations: {
        destructiveHint: true,
      },
    },
    async ({ id }) => jsonResult((await withTripIt((client) => client.deleteHotel(id))) as Record<string, unknown>),
  );

  server.registerTool(
    "tripit_hotels_attach_document",
    {
      title: "TripIt Hotels Attach Document",
      description: "Attach an image or PDF document to a hotel reservation.",
      inputSchema: {
        id: z.string().min(1).describe("Hotel ID or UUID."),
        file: z.string().min(1).describe("Path to the file on the local filesystem."),
        name: z.string().optional().describe("Document caption or name."),
        mimeType: z.string().optional().describe("Optional MIME type override."),
      },
    },
    async ({ id, file, name, mimeType }) =>
      jsonResult(
        (await withTripIt((client) =>
          client.attachDocument({
            objectType: "lodging",
            objectId: id,
            filePath: file,
            caption: name,
            mimeType,
          }),
        )) as Record<string, unknown>,
      ),
  );

  server.registerTool(
    "tripit_hotels_remove_document",
    {
      title: "TripIt Hotels Remove Document",
      description: "Remove a document from a hotel reservation.",
      inputSchema: {
        id: z.string().min(1).describe("Hotel ID or UUID."),
        uuid: z.string().optional().describe("Attachment UUID to remove."),
        imageUuid: z.string().optional().describe("Deprecated alias for uuid."),
        url: z.string().optional().describe("Document URL to remove."),
        caption: z.string().optional().describe("Remove the first document with this caption."),
        index: z.number().int().positive().optional().describe("1-based document index to remove."),
        all: z.boolean().optional().describe("When true, remove all documents."),
      },
      annotations: {
        destructiveHint: true,
      },
    },
    async ({ id, uuid, imageUuid, url, caption, index, all }) => {
      const resolvedUuid = uuid ?? imageUuid;
      requireExactlyOneSelector(
        [Boolean(resolvedUuid), Boolean(url), Boolean(caption), index !== undefined, Boolean(all)],
        "Provide exactly one selector: uuid, imageUuid, url, caption, index, or all.",
      );

      // Read, filter, replace (./documents): the library's removal wipes the hotel's other fields.
      return jsonResult(
        await withTripIt((client) =>
          removeOwn(client, "lodging", id, { uuid: resolvedUuid, url, caption, index, all }),
        ),
      );
    },
  );
}
