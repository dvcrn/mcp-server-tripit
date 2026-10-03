import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { tripitCreate, tripitDelete, tripitGet, tripitReplace, withLockedObject } from "../api";
import { withTripIt } from "../client";
import { mergeReplace, normalizeTime, writable } from "../payloads";
import { jsonResult } from "../results";

type Obj = Record<string, unknown>;

// Car rentals (TripIt's CarObject). The tripit library has no car support, so these call TripIt's
// car endpoints directly (../api). An update reads the car and replaces it with every writable
// field kept (../payloads): fields not passed are never wiped.

const carFields = {
  trip: z.string().describe("Trip UUID or Trip ID."),
  supplier: z.string().describe("Rental company, such as Hertz."),
  confirmation: z.string().describe("Confirmation number."),
  pickupDate: z.string().describe("Pickup date in YYYY-MM-DD format."),
  pickupTime: z.string().describe("Pickup time in HH:MM format."),
  pickupTimezone: z.string().describe("Pickup timezone, such as Pacific/Honolulu."),
  dropoffDate: z.string().describe("Dropoff date in YYYY-MM-DD format."),
  dropoffTime: z.string().describe("Dropoff time in HH:MM format."),
  dropoffTimezone: z.string().describe("Dropoff timezone."),
  timezone: z.string().describe("Timezone for both pickup and dropoff when they share one."),
  pickupLocationName: z.string().describe("Pickup location name, such as Denver International Airport (DEN)."),
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
  carType: z.string().describe("Car type or class, such as Jeep Wrangler or similar."),
  carDescription: z.string().describe("Car description."),
  cost: z.string().describe("Total cost, such as 612.50 USD."),
  notes: z.string().describe("Notes for the booking."),
};

type CarArgs = { [K in keyof typeof carFields]?: string };

function optionalShape() {
  const shape: Record<string, z.ZodOptional<z.ZodString>> = {};
  for (const [k, v] of Object.entries(carFields)) shape[k] = v.optional();
  return shape;
}

function tripKey(trip: string): "trip_uuid" | "trip_id" {
  return trip.includes("-") ? "trip_uuid" : "trip_id";
}

/** The caller's arguments as a CarObject fragment; absent arguments are left out. */
export function carChanges(a: CarArgs, fillTimezones: boolean): Obj {
  let pickupTz = a.pickupTimezone ?? a.timezone;
  let dropoffTz = a.dropoffTimezone ?? a.timezone;
  if (fillTimezones) {
    // A new rental with one timezone given uses it at both ends.
    pickupTz = pickupTz ?? dropoffTz;
    dropoffTz = dropoffTz ?? pickupTz;
  }
  const changes: Obj = {
    supplier_name: a.supplier,
    supplier_conf_num: a.confirmation,
    total_cost: a.cost,
    notes: a.notes,
    StartDateTime: { date: a.pickupDate, time: normalizeTime(a.pickupTime), timezone: pickupTz },
    EndDateTime: { date: a.dropoffDate, time: normalizeTime(a.dropoffTime), timezone: dropoffTz },
    StartLocationAddress: { address: a.pickupAddress, city: a.pickupCity, state: a.pickupState, zip: a.pickupZip, country: a.pickupCountry },
    EndLocationAddress: { address: a.dropoffAddress, city: a.dropoffCity, state: a.dropoffState, zip: a.dropoffZip, country: a.dropoffCountry },
    start_location_name: a.pickupLocationName,
    end_location_name: a.dropoffLocationName,
    car_type: a.carType,
    car_description: a.carDescription,
  };
  if (a.trip) {
    // Moving to another trip: set the key that matches the identifier, drop the other.
    changes[tripKey(a.trip)] = a.trip;
    changes[tripKey(a.trip) === "trip_uuid" ? "trip_id" : "trip_uuid"] = null;
  }
  return changes;
}

export function registerCarTools(server: McpServer): void {
  server.registerTool(
    "tripit_cars_get",
    {
      title: "TripIt Cars Get",
      description: "Get a car rental by ID or UUID.",
      inputSchema: { id: z.string().min(1).describe("Car rental ID or UUID.") },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ id }) => jsonResult(await withTripIt((client) => tripitGet(client, "car", id))),
  );

  server.registerTool(
    "tripit_cars_create",
    {
      title: "TripIt Cars Create",
      description: "Add a car rental to a trip.",
      inputSchema: {
        ...optionalShape(),
        trip: carFields.trip.min(1),
        supplier: carFields.supplier.min(1),
        pickupDate: carFields.pickupDate.min(1),
        dropoffDate: carFields.dropoffDate.min(1),
      },
    },
    async (args) =>
      jsonResult(
        await withTripIt((client) => tripitCreate(client, "car", "CarObject", writable("car", carChanges(args, true)))),
      ),
  );

  server.registerTool(
    "tripit_cars_update",
    {
      title: "TripIt Cars Update",
      description:
        "Update a car rental. Only the fields passed change; everything else on the rental is kept.",
      inputSchema: { id: z.string().min(1).describe("Car rental ID or UUID."), ...optionalShape() },
    },
    async ({ id, ...args }) =>
      jsonResult(
        await withTripIt((client) =>
          withLockedObject(client, "car", "CarObject", id, (existing) =>
            tripitReplace(client, "car", String(existing.uuid), "CarObject", mergeReplace("car", existing, carChanges(args, false))),
          ),
        ),
      ),
  );

  server.registerTool(
    "tripit_cars_delete",
    {
      title: "TripIt Cars Delete",
      description: "Delete a car rental by ID or UUID.",
      inputSchema: { id: z.string().min(1).describe("Car rental ID or UUID.") },
      annotations: { destructiveHint: true },
    },
    async ({ id }) => jsonResult(await withTripIt((client) => tripitDelete(client, "car", id))),
  );
}
