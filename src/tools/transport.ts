import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { withTripIt } from "../client";
import { jsonResult } from "../results";

export function registerTransportTools(server: McpServer): void {
  server.registerTool(
    "tripit_transport_get",
    {
      title: "TripIt Transport Get",
      description: "Get a transport item by ID or UUID.",
      inputSchema: {
        id: z.string().min(1).describe("Transport ID or UUID."),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ id }) => jsonResult((await withTripIt((client) => client.getTransport(id))) as Record<string, unknown>),
  );

  server.registerTool(
    "tripit_transport_create",
    {
      title: "TripIt Transport Create",
      description: "Add a transport segment to a trip.",
      inputSchema: {
        trip: z.string().min(1).describe("Trip UUID or Trip ID."),
        from: z.string().min(1).describe("Start address."),
        to: z.string().min(1).describe("End address."),
        departDate: z.string().min(1).describe("Departure date in YYYY-MM-DD format."),
        departTime: z.string().min(1).describe("Departure time in HH:MM format."),
        arriveDate: z.string().min(1).describe("Arrival date in YYYY-MM-DD format."),
        arriveTime: z.string().min(1).describe("Arrival time in HH:MM format."),
        timezone: z.string().min(1).describe("Timezone."),
        fromName: z.string().optional().describe("Start location name."),
        toName: z.string().optional().describe("End location name."),
        name: z.string().optional().describe("Display name."),
        vehicle: z.string().optional().describe("Vehicle description."),
        carrier: z.string().optional().describe("Carrier name."),
        confirmation: z.string().optional().describe("Confirmation number."),
      },
    },
    async (args) =>
      jsonResult(
        (await withTripIt((client) =>
          client.createTransport({
            tripId: args.trip,
            startAddress: args.from,
            endAddress: args.to,
            startDate: args.departDate,
            startTime: args.departTime,
            endDate: args.arriveDate,
            endTime: args.arriveTime,
            timezone: args.timezone,
            startLocationName: args.fromName,
            endLocationName: args.toName,
            displayName: args.name,
            vehicleDescription: args.vehicle,
            carrierName: args.carrier,
            confirmationNum: args.confirmation,
          }),
        )) as Record<string, unknown>,
      ),
  );

  server.registerTool(
    "tripit_transport_update",
    {
      title: "TripIt Transport Update",
      description: "Update an existing transport item.",
      inputSchema: {
        id: z.string().min(1).describe("Transport ID or UUID."),
        trip: z.string().optional().describe("Trip UUID or Trip ID."),
        from: z.string().optional().describe("Start address."),
        to: z.string().optional().describe("End address."),
        departDate: z.string().optional().describe("Departure date in YYYY-MM-DD format."),
        departTime: z.string().optional().describe("Departure time in HH:MM format."),
        arriveDate: z.string().optional().describe("Arrival date in YYYY-MM-DD format."),
        arriveTime: z.string().optional().describe("Arrival time in HH:MM format."),
        timezone: z.string().optional().describe("Timezone."),
        fromName: z.string().optional().describe("Start location name."),
        toName: z.string().optional().describe("End location name."),
        name: z.string().optional().describe("Display name."),
        vehicle: z.string().optional().describe("Vehicle description."),
        carrier: z.string().optional().describe("Carrier name."),
        confirmation: z.string().optional().describe("Confirmation number."),
      },
    },
    async (args) =>
      jsonResult(
        (await withTripIt((client) =>
          client.updateTransport({
            id: args.id,
            tripId: args.trip,
            startAddress: args.from,
            endAddress: args.to,
            startDate: args.departDate,
            startTime: args.departTime,
            endDate: args.arriveDate,
            endTime: args.arriveTime,
            timezone: args.timezone,
            startLocationName: args.fromName,
            endLocationName: args.toName,
            displayName: args.name,
            vehicleDescription: args.vehicle,
            carrierName: args.carrier,
            confirmationNum: args.confirmation,
          }),
        )) as Record<string, unknown>,
      ),
  );

  server.registerTool(
    "tripit_transport_delete",
    {
      title: "TripIt Transport Delete",
      description: "Delete a transport item by ID or UUID.",
      inputSchema: {
        id: z.string().min(1).describe("Transport ID or UUID."),
      },
      annotations: {
        destructiveHint: true,
      },
    },
    async ({ id }) => jsonResult((await withTripIt((client) => client.deleteTransport(id))) as Record<string, unknown>),
  );
}
