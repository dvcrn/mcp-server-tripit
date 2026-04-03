import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ALL_TOOL_NAMES } from "../src/types";

type ParsedToolResult = {
  content?: Array<{ type: string; text?: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

function parseToolResult(result: Awaited<ReturnType<Client["callTool"]>>): Record<string, any> {
  const parsed = result as ParsedToolResult;

  if (parsed.structuredContent) {
    return parsed.structuredContent as Record<string, any>;
  }

  const textBlock = parsed.content?.find((item) => item.type === "text");
  if (!textBlock?.text) {
    throw new Error("Tool result did not include text content.");
  }

  return JSON.parse(textBlock.text) as Record<string, any>;
}

async function callTool(client: Client, name: string, args: Record<string, unknown> = {}) {
  const result = (await client.callTool({ name, arguments: args })) as ParsedToolResult;
  if (result.isError) {
    throw new Error(`Tool ${name} returned an MCP error result.`);
  }

  return parseToolResult(result as Awaited<ReturnType<Client["callTool"]>>);
}

async function main(): Promise<void> {
  const transport = new StdioClientTransport({
    command: "bun",
    args: ["run", "dist/index.js"],
    cwd: process.cwd(),
    env: {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? "",
      TRIPIT_CLIENT_ID: process.env.TRIPIT_CLIENT_ID ?? "",
      TRIPIT_USERNAME: process.env.TRIPIT_USERNAME ?? "",
      TRIPIT_PASSWORD: process.env.TRIPIT_PASSWORD ?? "",
    },
    stderr: "inherit",
  });

  const client = new Client({ name: "tripit-smoke-test", version: "0.1.0" });
  await client.connect(transport);

  const created: {
    tripId?: string;
    hotelId?: string;
    flightId?: string;
    transportId?: string;
    activityId?: string;
  } = {};

  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  const startDate = new Date(now.getTime() + day).toISOString().slice(0, 10);
  const endDate = new Date(now.getTime() + 3 * day).toISOString().slice(0, 10);
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const tripName = `MCP Smoke Test ${stamp}`;

  try {
    const tools = await client.listTools();
    const registeredToolNames = new Set(tools.tools.map((tool) => tool.name));

    for (const toolName of ALL_TOOL_NAMES) {
      if (!registeredToolNames.has(toolName)) {
        throw new Error(`Expected MCP tool ${toolName} to be registered.`);
      }
    }

    const login = await callTool(client, "tripit_login");
    if (!login.accessTokenAvailable) {
      throw new Error("Login tool did not authenticate successfully.");
    }

    const trip = await callTool(client, "tripit_trips_create", {
      name: tripName,
      start: startDate,
      end: endDate,
      location: "Tokyo",
    });
    created.tripId = trip.Trip?.uuid;
    if (!created.tripId) {
      throw new Error("Trip creation did not return a trip UUID.");
    }

    const hotel = await callTool(client, "tripit_hotels_create", {
      trip: created.tripId,
      name: `Hotel ${stamp}`,
      checkin: startDate,
      checkout: endDate,
      checkinTime: "15:00",
      checkoutTime: "11:00",
      timezone: "UTC",
      address: "1 Test Street",
      city: "Tokyo",
      country: "JP",
      notes: "Created by MCP smoke test",
    });
    created.hotelId = hotel.LodgingObject?.uuid;
    if (!created.hotelId) {
      throw new Error("Hotel creation did not return a UUID.");
    }

    const flight = await callTool(client, "tripit_flights_create", {
      trip: created.tripId,
      name: `Flight ${stamp}`,
      airline: "Example Air",
      from: "Tokyo",
      fromCode: "JP",
      to: "Osaka",
      toCode: "JP",
      airlineCode: "EA",
      flightNum: "123",
      departDate: startDate,
      departTime: "09:00",
      departTz: "UTC",
      arriveDate: startDate,
      arriveTime: "10:30",
      arriveTz: "UTC",
      notes: "Created by MCP smoke test",
    });
    created.flightId = flight.AirObject?.uuid;
    if (!created.flightId) {
      throw new Error("Flight creation did not return a UUID.");
    }

    const transportItem = await callTool(client, "tripit_transport_create", {
      trip: created.tripId,
      from: "1 Test Street, Tokyo",
      to: "Tokyo Station",
      departDate: startDate,
      departTime: "08:00",
      arriveDate: startDate,
      arriveTime: "08:45",
      timezone: "UTC",
      name: `Transport ${stamp}`,
    });
    created.transportId = transportItem.TransportObject?.uuid;
    if (!created.transportId) {
      throw new Error("Transport creation did not return a UUID.");
    }

    const activity = await callTool(client, "tripit_activities_create", {
      trip: created.tripId,
      name: `Dinner ${stamp}`,
      startDate,
      startTime: "19:00",
      endDate: startDate,
      endTime: "21:00",
      timezone: "UTC",
      address: "2 Test Avenue",
      locationName: "Smoke Test Restaurant",
      city: "Tokyo",
      country: "JP",
    });
    created.activityId = activity.ActivityObject?.uuid;
    if (!created.activityId) {
      throw new Error("Activity creation did not return a UUID.");
    }

    const fetchedTrip = await callTool(client, "tripit_trips_get", {
      id: created.tripId,
    });

    const asArray = (value: unknown) => (Array.isArray(value) ? value : value ? [value] : []);
    if (asArray(fetchedTrip.LodgingObject).length < 1) {
      throw new Error("Trip lookup did not include the hotel booking.");
    }
    if (asArray(fetchedTrip.AirObject).length < 1) {
      throw new Error("Trip lookup did not include the flight booking.");
    }
    if (asArray(fetchedTrip.TransportObject).length < 1) {
      throw new Error("Trip lookup did not include the transport booking.");
    }
    if (asArray(fetchedTrip.ActivityObject).length < 1) {
      throw new Error("Trip lookup did not include the activity booking.");
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          tripId: created.tripId,
          hotelId: created.hotelId,
          flightId: created.flightId,
          transportId: created.transportId,
          activityId: created.activityId,
        },
        null,
        2,
      ),
    );
  } finally {
    const cleanupSteps: Array<Promise<unknown>> = [];

    if (created.activityId) {
      cleanupSteps.push(callTool(client, "tripit_activities_delete", { id: created.activityId }).catch(() => undefined));
    }
    if (created.transportId) {
      cleanupSteps.push(callTool(client, "tripit_transport_delete", { id: created.transportId }).catch(() => undefined));
    }
    if (created.flightId) {
      cleanupSteps.push(callTool(client, "tripit_flights_delete", { id: created.flightId }).catch(() => undefined));
    }
    if (created.hotelId) {
      cleanupSteps.push(callTool(client, "tripit_hotels_delete", { id: created.hotelId }).catch(() => undefined));
    }
    if (created.tripId) {
      cleanupSteps.push(callTool(client, "tripit_trips_delete", { id: created.tripId }).catch(() => undefined));
    }

    await Promise.all(cleanupSteps);
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
