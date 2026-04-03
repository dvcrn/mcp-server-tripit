import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { withTripIt } from "../client";
import { jsonResult } from "../results";

export function registerActivityTools(server: McpServer): void {
  server.registerTool(
    "tripit_activities_get",
    {
      title: "TripIt Activities Get",
      description: "Get an activity by ID or UUID.",
      inputSchema: {
        id: z.string().min(1).describe("Activity ID or UUID."),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ id }) => jsonResult((await withTripIt((client) => client.getActivity(id))) as Record<string, unknown>),
  );

  server.registerTool(
    "tripit_activities_create",
    {
      title: "TripIt Activities Create",
      description: "Add an activity to a trip.",
      inputSchema: {
        trip: z.string().min(1).describe("Trip UUID or Trip ID."),
        name: z.string().min(1).describe("Activity name."),
        startDate: z.string().min(1).describe("Start date in YYYY-MM-DD format."),
        startTime: z.string().min(1).describe("Start time in HH:MM format."),
        endDate: z.string().min(1).describe("End date in YYYY-MM-DD format."),
        endTime: z.string().min(1).describe("End time in HH:MM format."),
        timezone: z.string().min(1).describe("Timezone."),
        address: z.string().min(1).describe("Street address."),
        locationName: z.string().min(1).describe("Location or venue name."),
        city: z.string().optional().describe("City."),
        state: z.string().optional().describe("State or province."),
        zip: z.string().optional().describe("Postal code."),
        country: z.string().optional().describe("Country code."),
      },
    },
    async (args) =>
      jsonResult(
        (await withTripIt((client) =>
          client.createActivity({
            tripId: args.trip,
            displayName: args.name,
            startDate: args.startDate,
            startTime: args.startTime,
            endDate: args.endDate,
            endTime: args.endTime,
            timezone: args.timezone,
            address: args.address,
            locationName: args.locationName,
            city: args.city,
            state: args.state,
            zip: args.zip,
            country: args.country,
          }),
        )) as Record<string, unknown>,
      ),
  );

  server.registerTool(
    "tripit_activities_update",
    {
      title: "TripIt Activities Update",
      description: "Update an existing activity.",
      inputSchema: {
        id: z.string().min(1).describe("Activity ID or UUID."),
        trip: z.string().optional().describe("Trip UUID or Trip ID."),
        name: z.string().optional().describe("Activity name."),
        startDate: z.string().optional().describe("Start date in YYYY-MM-DD format."),
        startTime: z.string().optional().describe("Start time in HH:MM format."),
        endDate: z.string().optional().describe("End date in YYYY-MM-DD format."),
        endTime: z.string().optional().describe("End time in HH:MM format."),
        timezone: z.string().optional().describe("Timezone."),
        address: z.string().optional().describe("Street address."),
        locationName: z.string().optional().describe("Location or venue name."),
        city: z.string().optional().describe("City."),
        state: z.string().optional().describe("State or province."),
        zip: z.string().optional().describe("Postal code."),
        country: z.string().optional().describe("Country code."),
        notes: z.string().optional().describe("Activity notes."),
      },
    },
    async (args) =>
      jsonResult(
        (await withTripIt((client) =>
          client.updateActivity({
            id: args.id,
            tripId: args.trip,
            displayName: args.name,
            startDate: args.startDate,
            startTime: args.startTime,
            endDate: args.endDate,
            endTime: args.endTime,
            timezone: args.timezone,
            address: args.address,
            locationName: args.locationName,
            city: args.city,
            state: args.state,
            zip: args.zip,
            country: args.country,
            notes: args.notes,
          }),
        )) as Record<string, unknown>,
      ),
  );

  server.registerTool(
    "tripit_activities_delete",
    {
      title: "TripIt Activities Delete",
      description: "Delete an activity by ID or UUID.",
      inputSchema: {
        id: z.string().min(1).describe("Activity ID or UUID."),
      },
      annotations: {
        destructiveHint: true,
      },
    },
    async ({ id }) => jsonResult((await withTripIt((client) => client.deleteActivity(id))) as Record<string, unknown>),
  );
}
