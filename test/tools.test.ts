import { test, expect, mock } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { TripIt } from "tripit";

const tripit = new TripIt({ username: "offline", password: "offline" });
const objects = new Map<string, Record<string, any>>();
let counter = 0;
Object.assign(tripit, {
  apiGet: async (path: string) => {
    const [, action, type, , id] = new URL(path).pathname.split("/").slice(1);
    const object = objects.get(`${type}:${id}`);
    if (!object) throw new Error("API error (404): not found");
    if (action === "delete") {
      objects.delete(`${type}:${id}`);
      return {};
    }
    return {
      [type === "car" ? "CarObject" : "LodgingObject"]: structuredClone(object),
    };
  },
  apiPost: async (path: string, payload: Record<string, any>) => {
    const type = path.includes("/car/") ? "car" : "lodging";
    const key = type === "car" ? "CarObject" : "LodgingObject";
    const object = structuredClone(payload[key]);
    object.uuid ??= `synthetic-${++counter}`;
    object.is_display_name_auto_generated = object.display_name ? false : true;
    objects.set(`${type}:${object.uuid}`, object);
    return { [key]: structuredClone(object) };
  },
  buildImageAttachment: async ({ caption }: { caption: string }) => ({
    caption,
    ImageData: { content: "AA==", mime_type: "application/pdf" },
  }),
});
mock.module("../src/client", () => ({
  withTripIt: async (fn: (client: any) => unknown) => fn(tripit),
}));
const { registerCarTools } = await import("../src/tools/cars");
const { registerHotelTools } = await import("../src/tools/hotels");
const { registerDocumentTools } = await import("../src/tools/documents");

test("MCP tools call the pinned library for CRUD, edits and document preservation", async () => {
  const server = new McpServer({ name: "offline-test", version: "1" });
  registerCarTools(server);
  registerHotelTools(server);
  registerDocumentTools(server);
  const client = new Client({ name: "offline-test", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  const call = async (name: string, args: Record<string, unknown>) => {
    const result = await client.callTool({ name, arguments: args });
    if (result.isError) throw new Error(JSON.stringify(result.content));
    return result.structuredContent as Record<string, any>;
  };
  try {
    const { tools } = await client.listTools();
    expect(
      tools.find((t) => t.name === "tripit_cars_get")?.annotations
        ?.readOnlyHint,
    ).toBe(true);
    expect(
      tools.find((t) => t.name === "tripit_cars_delete")?.annotations
        ?.destructiveHint,
    ).toBe(true);
    for (const kind of ["cars", "hotels"]) {
      const key = kind === "cars" ? "CarObject" : "LodgingObject";
      const created = await call(
        `tripit_${kind}_create`,
        kind === "cars"
          ? {
              trip: "trip-1",
              supplier: "Synthetic Rentals",
              confirmation: "CONF",
              pickupDate: "2030-01-01",
              dropoffDate: "2030-01-02",
              pickupTime: "9:05",
              timezone: "Etc/UTC",
              notes: "keep",
              cost: "100 USD",
              displayName: "Custom",
            }
          : {
              trip: "trip-1",
              name: "Synthetic Hotel",
              checkin: "2030-01-01",
              checkout: "2030-01-02",
              checkinTime: "15:00",
              checkoutTime: "11:00",
              timezone: "Etc/UTC",
              address: "1 Example St",
              city: "Chicago",
              country: "US",
              confirmation: "CONF",
              notes: "keep",
              cost: "100 USD",
            },
      );
      const id = created[key].uuid;
      const agency = { agency_name: "Synthetic agency", agency_conf_num: "AGENCY" };
      objects.get(`${kind === "cars" ? "car" : "lodging"}:${id}`)!.Agency = {
        ...agency, partner_agency_id: "123",
      };
      const invalidTrip = await client.callTool({
        name: `tripit_${kind}_update`,
        arguments: { id, trip: null },
      });
      expect(invalidTrip.isError).toBe(true);
      await call(`tripit_${kind}_update`, { id, displayName: "Custom" });
      await call("tripit_documents_attach", {
        id,
        file: "synthetic.pdf",
        caption: "first",
      });
      await call(
        `tripit_${kind}_update`,
        kind === "cars"
          ? { id, dropoffTime: "12:15" }
          : { id, checkoutTime: "12:15", phone: "+1 202 555 0100" },
      );
      let object = (await call(`tripit_${kind}_get`, { id }))[key];
      expect(object.supplier_conf_num).toBe("CONF");
      expect(object.notes).toBe("keep");
      expect(object.Agency).toEqual(agency);
      expect(object.display_name).toBe("Custom");
      expect(object.EndDateTime.time).toBe("12:15:00");
      expect(object.Image.caption).toBe("first");
      await call(`tripit_${kind}_update`, { id, notes: null });
      await call("tripit_documents_attach", {
        id,
        type: kind === "cars" ? "car" : "lodging",
        file: "synthetic.pdf",
        caption: "second",
      });
      await call("tripit_documents_remove", { id, caption: "first" });
      object = (await call(`tripit_${kind}_get`, { id }))[key];
      expect(object.Image).toHaveLength(1);
      expect(object.Image[0].caption).toBe("second");
      expect(object.notes).toBeUndefined();
      expect(object.supplier_conf_num).toBe("CONF");
      await call("tripit_documents_remove", { id, all: true });
      object = (await call(`tripit_${kind}_get`, { id }))[key];
      expect(object.Image).toBeUndefined();
      expect(object.Agency).toEqual(agency);
      expect(object.display_name).toBe("Custom");
      const invalid = await client.callTool({
        name: "tripit_documents_remove",
        arguments: { id, all: true, index: 1 },
      });
      expect(invalid.isError).toBe(true);
      await call(`tripit_${kind}_delete`, { id });
      const deleted = await client.callTool({
        name: `tripit_${kind}_get`,
        arguments: { id },
      });
      expect(deleted.isError).toBe(true);
    }
    expect(objects.size).toBe(0);
  } finally {
    await client.close();
    await server.close();
  }
});
