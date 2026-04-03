import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { withTripIt } from "../client";
import { jsonResult } from "../results";

export function registerFlightTools(server: McpServer): void {
  server.registerTool(
    "tripit_flights_get",
    {
      title: "TripIt Flights Get",
      description: "Get a flight by ID or UUID.",
      inputSchema: {
        id: z.string().min(1).describe("Flight ID or UUID."),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ id }) => jsonResult((await withTripIt((client) => client.getFlight(id))) as Record<string, unknown>),
  );

  server.registerTool(
    "tripit_flights_create",
    {
      title: "TripIt Flights Create",
      description: "Add a flight to a trip.",
      inputSchema: {
        trip: z.string().min(1).describe("Trip UUID."),
        name: z.string().min(1).describe("Display name."),
        airline: z.string().min(1).describe("Airline name."),
        from: z.string().min(1).describe("Departure city."),
        fromCode: z.string().min(1).describe("Departure country code."),
        to: z.string().min(1).describe("Arrival city."),
        toCode: z.string().min(1).describe("Arrival country code."),
        airlineCode: z.string().min(1).describe("Airline code such as NH or JL."),
        flightNum: z.string().min(1).describe("Flight number."),
        departDate: z.string().min(1).describe("Departure date in YYYY-MM-DD format."),
        departTime: z.string().min(1).describe("Departure time in HH:MM format."),
        departTz: z.string().min(1).describe("Departure timezone."),
        arriveDate: z.string().min(1).describe("Arrival date in YYYY-MM-DD format."),
        arriveTime: z.string().min(1).describe("Arrival time in HH:MM format."),
        arriveTz: z.string().min(1).describe("Arrival timezone."),
        aircraft: z.string().optional().describe("Aircraft type."),
        serviceClass: z.string().optional().describe("Service class."),
        confirmation: z.string().optional().describe("Confirmation number."),
        notes: z.string().optional().describe("Flight notes."),
        cost: z.string().optional().describe("Total cost."),
      },
    },
    async (args) =>
      jsonResult(
        (await withTripIt((client) =>
          client.createFlight({
            tripId: args.trip,
            displayName: args.name,
            supplierName: args.airline,
            supplierConfNum: args.confirmation,
            notes: args.notes,
            totalCost: args.cost,
            segments: [
              {
                startDate: args.departDate,
                startTime: args.departTime,
                startTimezone: args.departTz,
                endDate: args.arriveDate,
                endTime: args.arriveTime,
                endTimezone: args.arriveTz,
                startCityName: args.from,
                startCountryCode: args.fromCode,
                endCityName: args.to,
                endCountryCode: args.toCode,
                marketingAirline: args.airlineCode,
                marketingFlightNumber: args.flightNum,
                aircraft: args.aircraft,
                serviceClass: args.serviceClass,
              },
            ],
          }),
        )) as Record<string, unknown>,
      ),
  );

  server.registerTool(
    "tripit_flights_update",
    {
      title: "TripIt Flights Update",
      description: "Update an existing flight.",
      inputSchema: {
        id: z.string().min(1).describe("Flight ID or UUID."),
        trip: z.string().optional().describe("Trip UUID."),
        name: z.string().optional().describe("Display name."),
        airline: z.string().optional().describe("Airline name."),
        from: z.string().optional().describe("Departure city."),
        fromCode: z.string().optional().describe("Departure country code."),
        to: z.string().optional().describe("Arrival city."),
        toCode: z.string().optional().describe("Arrival country code."),
        airlineCode: z.string().optional().describe("Airline code such as NH or JL."),
        flightNum: z.string().optional().describe("Flight number."),
        departDate: z.string().optional().describe("Departure date in YYYY-MM-DD format."),
        departTime: z.string().optional().describe("Departure time in HH:MM format."),
        departTz: z.string().optional().describe("Departure timezone."),
        arriveDate: z.string().optional().describe("Arrival date in YYYY-MM-DD format."),
        arriveTime: z.string().optional().describe("Arrival time in HH:MM format."),
        arriveTz: z.string().optional().describe("Arrival timezone."),
        aircraft: z.string().optional().describe("Aircraft type."),
        serviceClass: z.string().optional().describe("Service class."),
        confirmation: z.string().optional().describe("Confirmation number."),
        notes: z.string().optional().describe("Flight notes."),
        cost: z.string().optional().describe("Total cost."),
      },
    },
    async (args) =>
      jsonResult(
        (await withTripIt((client) =>
          client.updateFlight({
            id: args.id,
            tripId: args.trip,
            displayName: args.name,
            supplierName: args.airline,
            supplierConfNum: args.confirmation,
            notes: args.notes,
            totalCost: args.cost,
            segment: {
              startDate: args.departDate,
              startTime: args.departTime,
              startTimezone: args.departTz,
              endDate: args.arriveDate,
              endTime: args.arriveTime,
              endTimezone: args.arriveTz,
              startCityName: args.from,
              startCountryCode: args.fromCode,
              endCityName: args.to,
              endCountryCode: args.toCode,
              marketingAirline: args.airlineCode,
              marketingFlightNumber: args.flightNum,
              aircraft: args.aircraft,
              serviceClass: args.serviceClass,
            },
          }),
        )) as Record<string, unknown>,
      ),
  );

  server.registerTool(
    "tripit_flights_delete",
    {
      title: "TripIt Flights Delete",
      description: "Delete a flight by ID or UUID.",
      inputSchema: {
        id: z.string().min(1).describe("Flight ID or UUID."),
      },
      annotations: {
        destructiveHint: true,
      },
    },
    async ({ id }) => jsonResult((await withTripIt((client) => client.deleteFlight(id))) as Record<string, unknown>),
  );
}
