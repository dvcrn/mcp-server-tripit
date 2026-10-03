import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ALL_TOOL_NAMES } from "../src/types";

// Run only with a fresh HOME and an explicitly confirmed dev-account identity.
if (process.env.TRIPIT_LIVE_TEST !== "1")
  throw new Error("Set TRIPIT_LIVE_TEST=1 for mutating dev-account tests");

const expected = process.env.TRIPIT_DEV_IDENTITY?.toLowerCase();
if (!expected)
  throw new Error(
    "TRIPIT_DEV_IDENTITY must identify the authorized dev profile",
  );

const protocol = new Client({ name: "reservation-integration", version: "1" });
const env: Record<string, string> = {
  HOME: process.env.HOME!,
  PATH: process.env.PATH ?? "",
  TRIPIT_USERNAME: process.env.TRIPIT_USERNAME!,
  TRIPIT_PASSWORD: process.env.TRIPIT_PASSWORD!,
};
for (const name of [
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "NO_PROXY",
  "NODE_EXTRA_CA_CERTS",
  "SSL_CERT_FILE",
]) {
  if (process.env[name]) env[name] = process.env[name]!;
}
if (process.env.TRIPIT_CLIENT_ID)
  env.TRIPIT_CLIENT_ID = process.env.TRIPIT_CLIENT_ID;

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["run", "dist/index.js"],
  env,
  stderr: "pipe",
});

try {
  await protocol.connect(transport);
  const listed = await protocol.listTools();
  assert.deepEqual(
    listed.tools.map((t) => t.name).sort(),
    [...ALL_TOOL_NAMES].sort(),
  );
  console.log(
    `PASS built stdio MCP handshake and ${listed.tools.length} tools`,
  );

  async function call(
    name: string,
    args: Record<string, unknown>,
  ): Promise<any> {
    const result = await protocol.callTool({
      name: `tripit_${name}`,
      arguments: Object.fromEntries(
        Object.entries(args).filter(([, v]) => v !== undefined),
      ),
    });
    if (result.isError) {
      const content = result.content as Array<{ text?: string }>;
      throw new Error(content.map((c) => c.text ?? "").join("\n"));
    }
    return result.structuredContent;
  }

  function renameParams(
    params: Record<string, unknown>,
    names: Record<string, string>,
  ) {
    return Object.fromEntries(
      Object.entries(params).map(([key, value]) => [names[key] ?? key, value]),
    );
  }

  const carParamNames = {
    uuid: "id",
    tripId: "trip",
    supplierName: "supplier",
    supplierConfNum: "confirmation",
    totalCost: "cost",
  };
  const hotelParamNames = {
    uuid: "id",
    tripId: "trip",
    hotelName: "name",
    supplierConfNum: "confirmation",
    totalCost: "cost",
    bookingRate: "rate",
    checkInDate: "checkin",
    checkInTime: "checkinTime",
    checkOutDate: "checkout",
    checkOutTime: "checkoutTime",
    street: "address",
  };

  const client = {
    listTrips: (pageSize: number, pageNum: number) =>
      call("trips_list", { pageSize, pageNum }),
    createTrip: (p: any) =>
      call("trips_create", {
        name: p.displayName,
        start: p.startDate,
        end: p.endDate,
        location: p.primaryLocation,
      }),
    deleteTrip: (id: string) => call("trips_delete", { id }),
    getTrip: (id: string) => call("trips_get", { id }),
    createCar: (p: any) => call("cars_create", renameParams(p, carParamNames)),
    getCar: (id: string) => call("cars_get", { id }),
    updateCar: (p: any) => call("cars_update", renameParams(p, carParamNames)),
    deleteCar: (id: string) => call("cars_delete", { id }),
    createHotel: (p: any) =>
      call("hotels_create", renameParams(p, hotelParamNames)),
    getHotel: (id: string) => call("hotels_get", { id }),
    updateHotel: (p: any) =>
      call("hotels_update", renameParams(p, hotelParamNames)),
    deleteHotel: (id: string) => call("hotels_delete", { id }),
    attachDocument: (p: any) =>
      call("documents_attach", {
        id: p.objectId,
        type: p.objectType,
        file: p.filePath,
        caption: p.caption,
      }),
    removeDocument: (p: any) =>
      call("documents_remove", {
        id: p.objectId,
        type: p.objectType,
        caption: p.caption,
        all: p.removeAll,
      }),
  };

  const profile = (await client.listTrips(1, 1)).Profile;

  function matches(value: unknown): boolean {
    if (typeof value === "string") return value.toLowerCase() === expected;
    if (!value || typeof value !== "object") return false;
    return Object.values(value).some(matches);
  }

  assert(
    matches(profile),
    "Authenticated profile does not match the authorized dev identity",
  );
  console.log("PASS authenticated dev-account identity");

  const temp = await mkdtemp(join(tmpdir(), "tripit-fixtures-"));
  const filePath = join(temp, "synthetic.pdf");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>",
    "<< /Length 0 >>\nstream\n\nendstream",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 5\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((o) => `${String(o).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  await writeFile(filePath, pdf);

  let tripId: string | undefined;
  const created: Array<{ kind: "car" | "lodging"; id: string }> = [];
  const failures: unknown[] = [];

  function images(object: any) {
    if (!object.Image) return [];
    return Array.isArray(object.Image) ? object.Image : [object.Image];
  }

  const stable = (o: any) =>
    Object.fromEntries(
      Object.entries(o).filter(
        ([k]) =>
          ![
            "last_modified",
            "EstimatedStartDateTime",
            "EstimatedEndDateTime",
            "ReservationHolder",
          ].includes(k),
      ),
    );

  async function absent(get: () => Promise<unknown>) {
    try {
      await get();
    } catch (e) {
      assert(
        e instanceof Error &&
          /^API error \((400|404)\)/.test(e.message) &&
          /not found|does not exist|not a |no .*found|invalid.*(uuid|id)/i.test(
            e.message,
          ),
        "Deletion did not return a recognized missing-object response",
      );
      return;
    }
    throw new Error("Deleted object is still fetchable");
  }

  try {
    tripId = (
      await client.createTrip({
        displayName: `Synthetic reservation regression ${Date.now()}`,
        startDate: "2030-05-20",
        endDate: "2030-05-23",
        primaryLocation: "Chicago, IL",
      })
    ).Trip.uuid;
    assert(tripId);
    console.log("PASS dedicated trip create");

    const car = (
      await client.createCar({
        tripId,
        supplierName: "Synthetic Rentals",
        supplierConfNum: "SYN-CAR-1",
        displayName: "Custom synthetic car",
        pickupDate: "2030-05-20",
        pickupTime: "09:05",
        dropoffDate: "2030-05-23",
        dropoffTime: "10:00",
        timezone: "America/Chicago",
        pickupLocationName: "Synthetic pickup",
        dropoffLocationName: "Synthetic dropoff",
        pickupAddress: "1 Example Way",
        pickupCity: "Chicago",
        pickupState: "IL",
        pickupZip: "60601",
        pickupCountry: "US",
        dropoffAddress: "2 Example Way",
        dropoffCity: "Chicago",
        dropoffState: "IL",
        dropoffZip: "60601",
        dropoffCountry: "US",
        carType: "Compact",
        carDescription: "Synthetic compact car",
        notes: "Synthetic notes",
        totalCost: "100.00 USD",
      })
    ).CarObject;
    created.push({ kind: "car", id: car.uuid });

    const hotel = (
      await client.createHotel({
        tripId,
        hotelName: "Synthetic Hotel",
        checkInDate: "2030-05-20",
        checkInTime: "15:00",
        checkOutDate: "2030-05-23",
        checkOutTime: "11:00",
        timezone: "America/Chicago",
        street: "3 Example Way",
        city: "Chicago",
        state: "IL",
        zip: "60601",
        country: "US",
        supplierConfNum: "SYN-HOTEL-1",
        bookingRate: "50.00 USD",
        notes: "Synthetic notes",
        totalCost: "150.00 USD",
      })
    ).LodgingObject;
    created.push({ kind: "lodging", id: hotel.uuid });

    console.log("RUN hotel phone and custom-name edit");
    await client.updateHotel({
      uuid: hotel.uuid,
      phone: "+1 202 555 0100",
      displayName: "Custom synthetic hotel",
    });
    const updatedHotel = (await client.getHotel(hotel.uuid)).LodgingObject;
    assert.equal(updatedHotel.supplier_phone, "+1 202 555 0100");
    assert.equal(updatedHotel.display_name, "Custom synthetic hotel");
    assert.equal(
      (await client.getCar(car.uuid)).CarObject.display_name,
      "Custom synthetic car",
    );

    for (const { kind, id } of created) {
      console.log(`RUN ${kind} attachment and edits`);
      const get = async () =>
        kind === "car"
          ? (await client.getCar(id)).CarObject
          : (await client.getHotel(id)).LodgingObject;
      const update = (p: any) =>
        kind === "car"
          ? client.updateCar({ uuid: id, ...p })
          : client.updateHotel({ uuid: id, ...p });

      await client.attachDocument({
        objectType: kind,
        objectId: id,
        filePath,
        caption: "first synthetic document",
      });
      console.log(`PASS ${kind} first attachment`);
      const before = await get();
      assert.equal(images(before).length, 1);

      await update(
        kind === "car" ? { dropoffTime: "12:15" } : { checkOutTime: "12:15" },
      );
      const after = await get();
      const expected = structuredClone(before);
      expected.EndDateTime!.time = "12:15:00";
      assert.deepEqual(stable(after), stable(expected));

      await Promise.all([
        update({ notes: "edited" }),
        update({ uuid: id.toUpperCase(), supplierConfNum: "SYN-EDIT" }),
      ]);
      assert.equal((await get()).notes, "edited");
      assert.equal((await get()).supplier_conf_num, "SYN-EDIT");

      await update({ notes: "" });
      assert.equal((await get()).notes, "edited");

      await update({ notes: null });
      assert(!(await get()).notes);

      await client.attachDocument({
        objectId: id,
        filePath,
        caption: "second synthetic document",
      });
      assert.equal(images(await get()).length, 2);

      const beforeRemove = await get();
      await client.removeDocument({
        objectId: id,
        caption: "first synthetic document",
      });
      const afterRemove = await get();
      assert.equal(images(afterRemove).length, 1);
      assert.deepEqual(
        { ...stable(afterRemove), Image: undefined },
        { ...stable(beforeRemove), Image: undefined },
      );

      await client.removeDocument({
        objectType: kind,
        objectId: id,
        removeAll: true,
      });
      const empty = await get();
      assert.equal(images(empty).length, 0);
      assert.equal(empty.supplier_conf_num, "SYN-EDIT");
      assert.equal(empty.display_name, before.display_name);
      console.log(
        `PASS ${kind} CRUD, partial edit preservation, concurrent edits, null/empty semantics, custom name, document attach/remove/autodetect`,
      );
    }
  } catch (e) {
    failures.push(e);
  } finally {
    for (const { kind, id } of [...created].reverse()) {
      try {
        if (kind === "car") {
          await client.deleteCar(id);
          await absent(() => client.getCar(id));
        } else {
          await client.deleteHotel(id);
          await absent(() => client.getHotel(id));
        }
        console.log(`PASS ${kind} cleanup verified`);
      } catch (e) {
        failures.push(e);
        console.error(`Cleanup failed for synthetic ${kind} ${id}`);
      }
    }

    if (tripId)
      try {
        await client.deleteTrip(tripId);
        await absent(() => client.getTrip(tripId!));
        console.log("PASS trip cleanup verified");
      } catch (e) {
        failures.push(e);
        console.error(`Cleanup failed for synthetic trip ${tripId}`);
      }

    await rm(temp, { recursive: true, force: true });
  }

  if (failures.length)
    throw new AggregateError(
      failures,
      "Live reservation regression or cleanup failed",
    );
} finally {
  await protocol.close();
}
