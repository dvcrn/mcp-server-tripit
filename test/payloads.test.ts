// Run: node --experimental-strip-types --test mcp/tripit/server/test/
// payloads.ts has no imports, so Node runs it straight from source.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CAR_FIELDS, LODGING_FIELDS, mergeReplace, normalizeTime, remainingImages, writable } from "../src/payloads.ts";

// The shape TripIt returns for a car (taken from a real CarObject, values made up).
const CAR = {
  uuid: "aaaaaaaa-0000-9000-0004-000000000001",
  trip_uuid: "bbbbbbbb-0000-9000-0001-000000000001",
  is_client_traveler: "true",
  relative_url: "/reservation/show/uuid/aaaaaaaa-0000-9000-0004-000000000001",
  display_name: "Hertz Car Rental",
  is_display_name_auto_generated: "true",
  last_modified: "1790966208",
  booking_site_conf_num: "CONF123",
  booking_site_name: "Hertz",
  booking_site_phone: "1-800-000-0000",
  booking_site_url: "https://www.hertz.com/",
  supplier_conf_num: "CONF123",
  supplier_name: "Hertz",
  is_purchased: "true",
  notes: "Gold counter",
  total_cost: "100.00 USD",
  is_tripit_booking: "false",
  has_possible_cancellation: "false",
  is_concur_booked: "false",
  EstimatedStartDateTime: { date: "2030-05-20", time: "13:44:00", timezone: "America/Denver", utc_offset: "-06:00" },
  StartDateTime: { date: "2030-05-20", time: "12:44:00", timezone: "America/Denver", utc_offset: "-06:00", is_timezone_manual: "false" },
  EndDateTime: { date: "2030-05-26", time: "22:30:00", timezone: "America/Denver", utc_offset: "-06:00", is_timezone_manual: "false" },
  StartLocationAddress: { address: "1 Airport Rd", city: "Denver", state: "CO", zip: "80249", country: "US", latitude: "39.8", longitude: "-104.7" },
  EndLocationAddress: { address: "1 Airport Rd", city: "Denver", state: "CO", zip: "80249", country: "US", latitude: "39.8", longitude: "-104.7" },
  ReservationHolder: { first_name: "John", frequent_traveler_num: "123", frequent_traveler_supplier: "Hertz" },
  Driver: { first_name: "John", frequent_traveler_num: "123", frequent_traveler_supplier: "Hertz" },
  start_location_hours: "Mon-Sun 5:00AM-10:30PM.",
  start_location_name: "Denver Airport (DEN)",
  end_location_hours: "Mon-Sun 5:00AM-10:30PM.",
  end_location_name: "Denver Airport (DEN)",
  car_description: "Jeep 4x4",
  car_type: "JEEP WRANGLER or similar",
};

// display_name is read-only only while TripIt generates it (is_display_name_auto_generated "true").
const READ_ONLY = ["relative_url", "display_name", "is_display_name_auto_generated", "last_modified",
  "is_tripit_booking", "has_possible_cancellation", "is_concur_booked", "EstimatedStartDateTime", "EstimatedEndDateTime",
  "ReservationHolder", "utc_offset", "is_timezone_manual", "latitude", "longitude"];

function keysDeep(o: unknown, out: string[] = []): string[] {
  if (Array.isArray(o)) o.forEach((x) => keysDeep(x, out));
  else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) { out.push(k); keysDeep(v, out); }
  return out;
}

test("normalizeTime pads to HH:MM:SS and leaves missing alone", () => {
  assert.equal(normalizeTime("9:05"), "09:05:00");
  assert.equal(normalizeTime("22:30"), "22:30:00");
  assert.equal(normalizeTime("22:30:15"), "22:30:15");
  assert.equal(normalizeTime(undefined), undefined);
  assert.equal(normalizeTime(""), undefined);
  assert.throws(() => normalizeTime("noon"), /HH:MM/);
});

test("a dropoff-time-only change keeps every other writable field", () => {
  const out = mergeReplace("car", CAR, { EndDateTime: { time: "11:15" } }) as any;
  assert.equal(out.EndDateTime.time, "11:15:00");
  assert.equal(out.EndDateTime.date, "2030-05-26");
  assert.equal(out.EndDateTime.timezone, "America/Denver");
  for (const k of ["uuid", "trip_uuid", "booking_site_conf_num", "booking_site_name", "booking_site_phone", "booking_site_url",
    "supplier_conf_num", "supplier_name", "is_purchased", "notes", "total_cost", "start_location_hours", "start_location_name",
    "end_location_hours", "end_location_name", "car_description", "car_type"]) {
    assert.equal(out[k], (CAR as any)[k], k);
  }
  assert.deepEqual(out.StartDateTime, { date: "2030-05-20", time: "12:44:00", timezone: "America/Denver" });
  assert.deepEqual(out.StartLocationAddress, { address: "1 Airport Rd", city: "Denver", state: "CO", zip: "80249", country: "US" });
  assert.deepEqual(out.Driver, { first_name: "John", frequent_traveler_num: "123", frequent_traveler_supplier: "Hertz" });
});

test("read-only fields are never sent back", () => {
  const keys = keysDeep(mergeReplace("car", CAR, {}));
  for (const k of READ_ONLY) assert.ok(!keys.includes(k), k);
});

test("a custom display_name and is_client_traveler are kept; an auto-generated name is not", () => {
  // Live, 2026-10-02: a replace without display_name reverted a custom car name to the generated
  // one, and TripIt accepts is_client_traveler on replace.
  const custom = mergeReplace("car", { ...CAR, display_name: "Our Jeep", is_display_name_auto_generated: "false" }, {}) as any;
  assert.equal(custom.display_name, "Our Jeep");
  assert.equal(custom.is_client_traveler, "true");
  assert.ok(!("display_name" in (mergeReplace("car", CAR, {}) as any)));   // CAR's name is auto-generated
  const renamed = mergeReplace("car", CAR, { display_name: "Renamed" }) as any;   // an explicit change wins
  assert.equal(renamed.display_name, "Renamed");
});

test("a field the builder does not know refuses the update instead of wiping it", () => {
  assert.throws(() => mergeReplace("car", { ...CAR, Agency: { agency_name: "Expedia" } }, {}), /Agency/);
  assert.throws(() => mergeReplace("lodging", { uuid: "u", supplier_name: "H", room_category: "suite" }, {}), /room_category/);
  // A key only in the changes is the caller's own and is simply not sent.
  assert.doesNotThrow(() => mergeReplace("car", CAR, {}));
});

test("fields come out in TripIt's schema order", () => {
  const keys = Object.keys(mergeReplace("car", CAR, {}));
  assert.deepEqual(keys, CAR_FIELDS.filter((k) => keys.includes(k)));
  assert.deepEqual(keys.slice(0, 3), ["uuid", "trip_uuid", "is_client_traveler"]);
});

test("null removes a field; an empty string does not count as a value", () => {
  const out = mergeReplace("car", CAR, { notes: null, car_description: "" }) as any;
  assert.ok(!("notes" in out));
  assert.equal(out.car_description, "Jeep 4x4");
});

test("a dates-only hotel change keeps confirmation, phone, address and documents", () => {
  const hotel = {
    uuid: "cccccccc-0000-9000-0004-000000000001", trip_uuid: "bbbbbbbb-0000-9000-0001-000000000001",
    display_name: "Hotel", last_modified: "1", supplier_conf_num: "HOTEL123", supplier_name: "Airport Hotel",
    supplier_phone: "+1 555 0100", booking_rate: "USD 200", notes: "late arrival", total_cost: "USD 220.00",
    Image: [{ uuid: "img-1", caption: "voucher", url: "https://example.com/1.pdf" }],
    StartDateTime: { date: "2030-01-19", time: "23:45:00", timezone: "America/Chicago", utc_offset: "-06:00" },
    EndDateTime: { date: "2030-01-20", time: "07:00:00", timezone: "America/Chicago", utc_offset: "-06:00" },
    Address: { address: "1 Example Way", city: "Springfield", state: "IL", zip: "62701", country: "US", latitude: "39.8" },
  };
  const out = mergeReplace("lodging", hotel, { StartDateTime: { date: "2030-01-18" }, EndDateTime: { date: "2030-01-19" } }) as any;
  assert.equal(out.StartDateTime.date, "2030-01-18");
  assert.equal(out.EndDateTime.time, "07:00:00");
  for (const k of ["supplier_conf_num", "supplier_phone", "booking_rate", "notes", "total_cost", "supplier_name"]) {
    assert.equal(out[k], (hotel as any)[k], k);
  }
  assert.deepEqual(out.Address, { address: "1 Example Way", city: "Springfield", state: "IL", zip: "62701", country: "US" });
  assert.deepEqual(out.Image, hotel.Image);
  const keys = Object.keys(out);
  assert.deepEqual(keys, LODGING_FIELDS.filter((k) => keys.includes(k)));
});

test("writable keeps a fresh object's fields and nothing else", () => {
  const out = writable("car", { trip_uuid: "t-1", supplier_name: "Hertz", bogus: "x", StartDateTime: { date: "2030-01-01", time: "9:00" } }) as any;
  assert.deepEqual(out, { trip_uuid: "t-1", supplier_name: "Hertz", StartDateTime: { date: "2030-01-01", time: "09:00:00" } });
});

test("remainingImages follows the library's selection rules", () => {
  const imgs = [{ uuid: "a", url: "u1", caption: "one" }, { uuid: "b", url: "u2", caption: "two" }];
  assert.deepEqual(remainingImages(imgs, { uuid: "a" }), [imgs[1]]);
  assert.deepEqual(remainingImages(imgs, { url: "u2" }), [imgs[0]]);
  assert.deepEqual(remainingImages(imgs, { caption: "two" }), [imgs[0]]);
  assert.deepEqual(remainingImages(imgs, { index: 1 }), [imgs[1]]);
  assert.deepEqual(remainingImages(imgs, { all: true }), []);
  assert.deepEqual(remainingImages(imgs[0], { uuid: "a" }), []);   // a single image is not wrapped
  assert.throws(() => remainingImages(imgs, { uuid: "zz" }), /No document found with UUID zz/);
  assert.throws(() => remainingImages(imgs, { index: 3 }), /out of range/);
  assert.throws(() => remainingImages(undefined, { all: true }), /No documents found/);
});

test("only a 4xx or a missing object counts as 'not this type'", async () => {
  const { isWrongType } = await import("../src/api.ts");
  assert.equal(isWrongType(new Error('API error (400): {"Error":"object is not a lodging object"}')), true);
  assert.equal(isWrongType(new Error("API error (404): not found")), true);
  assert.equal(isWrongType(new Error("No LodgingObject with identifier x")), true);
  assert.equal(isWrongType(new Error("API error (500): oops")), false);    // TripIt down: stop, do not fall through
  assert.equal(isWrongType(new Error("API error (429): slow down")), false);
  for (const code of [401, 403, 408, 409, 422]) {                       // auth and other client failures surface
    assert.equal(isWrongType(new Error(`API error (${code}): x`)), false, String(code));
  }
  assert.equal(isWrongType(new TypeError("fetch failed")), false);         // network
});

test("a nested field the builder does not know refuses too; known read-only nested ones do not", () => {
  assert.throws(() => mergeReplace("car", { ...CAR, StartDateTime: { ...CAR.StartDateTime, dst_rule: "x" } }, {}), /StartDateTime\.dst_rule/);
  assert.throws(() => mergeReplace("car", { ...CAR, StartLocationAddress: { ...CAR.StartLocationAddress, plus_code: "x" } }, {}), /StartLocationAddress\.plus_code/);
  assert.throws(() => mergeReplace("car", { ...CAR, Driver: { ...CAR.Driver, loyalty_tier: "gold" } }, {}), /Driver\.loyalty_tier/);
  assert.doesNotThrow(() => mergeReplace("car", CAR, {}));   // utc_offset, is_timezone_manual, latitude, longitude are known
  // TripIt's computed risk rating on an address (seen live on a hotel address).
  const rated = mergeReplace("car", { ...CAR, StartLocationAddress: { ...CAR.StartLocationAddress, risk_level: "1" } }, {}) as any;
  assert.ok(!("risk_level" in rated.StartLocationAddress));
});

test("operations on the same object run one at a time; different objects do not wait", async () => {
  const { withObjectLock } = await import("../src/api.ts");
  const log: string[] = [];
  const step = (name: string, ms: number) => async () => {
    log.push(name + " start"); await new Promise((r) => setTimeout(r, ms)); log.push(name + " end"); return name;
  };
  const results = await Promise.all([
    withObjectLock("car:1", step("a", 30)),
    withObjectLock("car:1", step("b", 1)),
    withObjectLock("car:2", step("c", 1)),
  ]);
  assert.deepEqual(results, ["a", "b", "c"]);
  assert.ok(log.indexOf("a end") < log.indexOf("b start"), log.join(", "));   // b waited for a
  assert.ok(log.indexOf("c end") < log.indexOf("a end"), log.join(", "));     // c did not
  await assert.rejects(withObjectLock("car:1", async () => { throw new Error("boom"); }), /boom/);
  assert.equal(await withObjectLock("car:1", async () => "after"), "after");  // a failure does not jam the lock
});

test("a numeric id and a UUID for one object take the same lock", async () => {
  const { withLockedObject } = await import("../src/api.ts");
  const UUID = "11111111-2222-9000-0004-000000000001";
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ CarObject: { uuid: UUID, supplier_name: "Hertz" } }))) as any;
  const client = { getAccessToken: () => "t" } as any;
  const log: string[] = [];
  const op = (name: string, ms: number) => async (existing: Record<string, unknown>) => {
    log.push(`${name} start ${existing.uuid}`); await new Promise((r) => setTimeout(r, ms)); log.push(`${name} end`); return name;
  };
  try {
    const out = await Promise.all([
      withLockedObject(client, "car", "CarObject", "5415", op("by-id", 30)),
      withLockedObject(client, "car", "CarObject", UUID, op("by-uuid", 1)),
    ]);
    assert.deepEqual(out, ["by-id", "by-uuid"]);
    // No overlap, whichever got the lock first: the second starts only after the first ends.
    assert.deepEqual(log.map((l) => l.split(" ")[1]), ["start", "end", "start", "end"], log.join(", "));
    assert.ok(log.includes(`by-id start ${UUID}`));   // the numeric id was resolved to the UUID
  } finally {
    globalThis.fetch = realFetch;
  }
});
