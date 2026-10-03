import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { withTripIt } from "../client";
import { jsonResult } from "../results";

const carFields = {
  displayName: z.string().describe("Custom reservation display name."),
  trip: z.string().describe("Trip UUID or Trip ID."),
  supplier: z.string().describe("Rental company, such as Hertz."),
  confirmation: z.string().describe("Confirmation number."),
  pickupDate: z.string().describe("Pickup date in YYYY-MM-DD format."),
  pickupTime: z.string().describe("Pickup time in HH:MM format."),
  pickupTimezone: z
    .string()
    .describe("Pickup timezone, such as Pacific/Honolulu."),
  dropoffDate: z.string().describe("Dropoff date in YYYY-MM-DD format."),
  dropoffTime: z.string().describe("Dropoff time in HH:MM format."),
  dropoffTimezone: z.string().describe("Dropoff timezone."),
  timezone: z
    .string()
    .describe("Timezone for both pickup and dropoff when they share one."),
  pickupLocationName: z
    .string()
    .describe(
      "Pickup location name, such as Denver International Airport (DEN).",
    ),
  pickupAddress: z.string().describe("Pickup street address."),
  pickupCity: z.string().describe("Pickup city."),
  pickupState: z.string().describe("Pickup state or province."),
  pickupZip: z.string().describe("Pickup postal code."),
  pickupCountry: z.string().describe("Pickup country code such as US."),
  dropoffLocationName: z.string().describe("Dropoff location name."),
  dropoffAddress: z.string().describe("Dropoff street address."),
  dropoffCity: z.string().describe("Dropoff city."),
  dropoffState: z.string().describe("Dropoff state or province."),
  dropoffZip: z.string().describe("Dropoff postal code."),
  dropoffCountry: z.string().describe("Dropoff country code."),
  carType: z
    .string()
    .describe("Car type or class, such as Jeep Wrangler or similar."),
  carDescription: z.string().describe("Car description."),
  cost: z.string().describe("Total cost, such as 612.50 USD."),
  notes: z.string().describe("Notes for the booking."),
};

function carParams(args: Record<string, string | null | undefined>) {
  return {
    displayName: args.displayName,
    tripId: args.trip,
    supplierName: args.supplier,
    supplierConfNum: args.confirmation,
    pickupDate: args.pickupDate,
    pickupTime: args.pickupTime,
    pickupTimezone: args.pickupTimezone,
    dropoffDate: args.dropoffDate,
    dropoffTime: args.dropoffTime,
    dropoffTimezone: args.dropoffTimezone,
    timezone: args.timezone,
    pickupLocationName: args.pickupLocationName,
    pickupAddress: args.pickupAddress,
    pickupCity: args.pickupCity,
    pickupState: args.pickupState,
    pickupZip: args.pickupZip,
    pickupCountry: args.pickupCountry,
    dropoffLocationName: args.dropoffLocationName,
    dropoffAddress: args.dropoffAddress,
    dropoffCity: args.dropoffCity,
    dropoffState: args.dropoffState,
    dropoffZip: args.dropoffZip,
    dropoffCountry: args.dropoffCountry,
    carType: args.carType,
    carDescription: args.carDescription,
    totalCost: args.cost,
    notes: args.notes,
  };
}

export function registerCarTools(server: McpServer): void {
  server.registerTool(
    "tripit_cars_get",
    {
      title: "TripIt Cars Get",
      description: "Get a car rental by ID or UUID.",
      inputSchema: { id: z.string().min(1) },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ id }) =>
      jsonResult(
        (await withTripIt((client) => client.getCar(id))) as Record<
          string,
          unknown
        >,
      ),
  );
  server.registerTool(
    "tripit_cars_create",
    {
      title: "TripIt Cars Create",
      description: "Add a car rental to a trip.",
      inputSchema: {
        displayName: carFields.displayName.optional(),
        trip: carFields.trip.min(1),
        supplier: carFields.supplier.min(1),
        confirmation: carFields.confirmation.optional(),
        pickupDate: carFields.pickupDate.min(1),
        pickupTime: carFields.pickupTime.optional(),
        pickupTimezone: carFields.pickupTimezone.optional(),
        dropoffDate: carFields.dropoffDate.min(1),
        dropoffTime: carFields.dropoffTime.optional(),
        dropoffTimezone: carFields.dropoffTimezone.optional(),
        timezone: carFields.timezone.optional(),
        pickupLocationName: carFields.pickupLocationName.optional(),
        pickupAddress: carFields.pickupAddress.optional(),
        pickupCity: carFields.pickupCity.optional(),
        pickupState: carFields.pickupState.optional(),
        pickupZip: carFields.pickupZip.optional(),
        pickupCountry: carFields.pickupCountry.optional(),
        dropoffLocationName: carFields.dropoffLocationName.optional(),
        dropoffAddress: carFields.dropoffAddress.optional(),
        dropoffCity: carFields.dropoffCity.optional(),
        dropoffState: carFields.dropoffState.optional(),
        dropoffZip: carFields.dropoffZip.optional(),
        dropoffCountry: carFields.dropoffCountry.optional(),
        carType: carFields.carType.optional(),
        carDescription: carFields.carDescription.optional(),
        cost: carFields.cost.optional(),
        notes: carFields.notes.optional(),
      },
    },
    async (args) =>
      jsonResult(
        (await withTripIt((client) =>
          client.createCar(carParams(args)),
        )) as Record<string, unknown>,
      ),
  );
  server.registerTool(
    "tripit_cars_update",
    {
      title: "TripIt Cars Update",
      description:
        "Update a car rental, preserving omitted fields. Null clears a field; empty strings leave it unchanged.",
      inputSchema: {
        id: z.string().min(1),
        displayName: carFields.displayName.nullable().optional(),
        trip: carFields.trip.optional(),
        supplier: carFields.supplier.nullable().optional(),
        confirmation: carFields.confirmation.nullable().optional(),
        pickupDate: carFields.pickupDate.nullable().optional(),
        pickupTime: carFields.pickupTime.nullable().optional(),
        pickupTimezone: carFields.pickupTimezone.nullable().optional(),
        dropoffDate: carFields.dropoffDate.nullable().optional(),
        dropoffTime: carFields.dropoffTime.nullable().optional(),
        dropoffTimezone: carFields.dropoffTimezone.nullable().optional(),
        timezone: carFields.timezone.nullable().optional(),
        pickupLocationName: carFields.pickupLocationName.nullable().optional(),
        pickupAddress: carFields.pickupAddress.nullable().optional(),
        pickupCity: carFields.pickupCity.nullable().optional(),
        pickupState: carFields.pickupState.nullable().optional(),
        pickupZip: carFields.pickupZip.nullable().optional(),
        pickupCountry: carFields.pickupCountry.nullable().optional(),
        dropoffLocationName: carFields.dropoffLocationName
          .nullable()
          .optional(),
        dropoffAddress: carFields.dropoffAddress.nullable().optional(),
        dropoffCity: carFields.dropoffCity.nullable().optional(),
        dropoffState: carFields.dropoffState.nullable().optional(),
        dropoffZip: carFields.dropoffZip.nullable().optional(),
        dropoffCountry: carFields.dropoffCountry.nullable().optional(),
        carType: carFields.carType.nullable().optional(),
        carDescription: carFields.carDescription.nullable().optional(),
        cost: carFields.cost.nullable().optional(),
        notes: carFields.notes.nullable().optional(),
      },
    },
    async ({ id, ...args }) =>
      jsonResult(
        (await withTripIt((client) =>
          client.updateCar({ id, ...carParams(args) }),
        )) as Record<string, unknown>,
      ),
  );
  server.registerTool(
    "tripit_cars_delete",
    {
      title: "TripIt Cars Delete",
      description: "Delete a car rental by ID or UUID.",
      inputSchema: { id: z.string().min(1) },
      annotations: { destructiveHint: true },
    },
    async ({ id }) =>
      jsonResult(
        (await withTripIt((client) => client.deleteCar(id))) as Record<
          string,
          unknown
        >,
      ),
  );
}
