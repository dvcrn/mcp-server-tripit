// Payloads for TripIt's create and replace calls, built from the object TripIt returns.
//
// A replace substitutes the whole object: a field left out is wiped, and a read-only field sent
// back (display_name, last_modified, utc_offset, coordinates...) makes the API answer 400. So an
// update starts from the existing object, keeps only its writable fields, applies the caller's
// changes and emits fields in TripIt's schema order. No imports: the unit tests run this file
// straight from source with Node's type stripping.

type Obj = Record<string, unknown>;
export type Kind = "car" | "lodging";

// Writable reservation fields, in TripIt's XSD order (shared by every reservation type).
const RESERVATION_FIELDS = [
  "Image",
  "booking_date",
  "booking_rate",
  "booking_site_conf_num",
  "booking_site_name",
  "booking_site_phone",
  "booking_site_url",
  "record_locator",
  "supplier_conf_num",
  "supplier_contact",
  "supplier_email_address",
  "supplier_name",
  "supplier_phone",
  "supplier_url",
  "is_purchased",
  "notes",
  "restrictions",
  "total_cost",
] as const;

export const CAR_FIELDS: readonly string[] = [
  "uuid",
  "trip_id",
  "trip_uuid",
  "is_client_traveler",
  "display_name",
  ...RESERVATION_FIELDS,
  "StartDateTime",
  "EndDateTime",
  "StartLocationAddress",
  "EndLocationAddress",
  "Driver",
  "start_location_hours",
  "start_location_name",
  "start_location_phone",
  "end_location_hours",
  "end_location_name",
  "end_location_phone",
  "car_description",
  "car_type",
  "mileage_charges",
];

export const LODGING_FIELDS: readonly string[] = [
  "uuid",
  "trip_id",
  "trip_uuid",
  "is_client_traveler",
  "display_name",
  ...RESERVATION_FIELDS,
  "StartDateTime",
  "EndDateTime",
  "Address",
  "Guest",
  "number_guests",
  "number_rooms",
  "room_type",
];

// What TripIt returns but never accepts back (sending them gets a 400) or computes itself.
// display_name is writable but only kept while custom (see mergeReplace).
const READ_ONLY_FIELDS = new Set([
  "id",
  "relative_url",
  "is_display_name_auto_generated",
  "last_modified",
  "is_tripit_booking",
  "has_possible_cancellation",
  "is_concur_booked",
  "EstimatedStartDateTime",
  "EstimatedEndDateTime",
  "ReservationHolder",
]);

const DATETIME_KEYS = ["date", "time", "timezone"];
const ADDRESS_KEYS = ["address", "addr1", "addr2", "city", "state", "zip", "country"];
const TRAVELER_KEYS = [
  "first_name",
  "middle_name",
  "last_name",
  "frequent_traveler_num",
  "frequent_traveler_supplier",
  "meal_preference",
  "seat_preference",
  "ticket_num",
];
const DATETIME_FIELDS = new Set(["StartDateTime", "EndDateTime"]);
// Nested keys TripIt returns, writable or read-only (utc_offset and is_timezone_manual it computes;
// coordinates it geocodes). Any other nested key refuses the update, like an unknown top-level one.
const NESTED_KNOWN: Record<string, Set<string>> = {};
const ADDRESS_FIELDS = new Set(["Address", "StartLocationAddress", "EndLocationAddress"]);
const TRAVELER_FIELDS = new Set(["Driver", "Guest"]);
for (const f of DATETIME_FIELDS) NESTED_KNOWN[f] = new Set([...DATETIME_KEYS, "utc_offset", "is_timezone_manual"]);
for (const f of ["Address", "StartLocationAddress", "EndLocationAddress"]) {
  NESTED_KNOWN[f] = new Set([...ADDRESS_KEYS, "latitude", "longitude", "risk_level"]);   // risk_level: TripIt's rating
}
for (const f of TRAVELER_FIELDS) NESTED_KNOWN[f] = new Set(TRAVELER_KEYS);

function isPlain(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function present(v: unknown): boolean {
  return v !== undefined && v !== null && v !== "";
}

/** "9:05" -> "09:05:00"; HH:MM:SS passes through; empty or missing stays undefined. */
export function normalizeTime(time: string | undefined): string | undefined {
  if (!present(time)) return undefined;
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(time).trim());
  if (!m) throw new Error(`Time must be HH:MM or HH:MM:SS, got '${time}'`);
  return `${m[1].padStart(2, "0")}:${m[2]}:${m[3] ?? "00"}`;
}

function pick(obj: Obj, keys: string[], map?: (k: string, v: unknown) => unknown): Obj | undefined {
  const out: Obj = {};
  for (const k of keys) {
    const v = map ? map(k, obj[k]) : obj[k];
    if (present(v)) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

function writableValue(field: string, value: unknown): unknown {
  if (DATETIME_FIELDS.has(field) && isPlain(value)) {
    return pick(value, DATETIME_KEYS, (k, v) => (k === "time" ? normalizeTime(v as string | undefined) : v));
  }
  if (ADDRESS_FIELDS.has(field) && isPlain(value)) return pick(value, ADDRESS_KEYS);
  if (TRAVELER_FIELDS.has(field)) {
    if (Array.isArray(value)) {
      const list = value.filter(isPlain).map((t) => pick(t, TRAVELER_KEYS)).filter(Boolean);
      return list.length ? list : undefined;
    }
    return isPlain(value) ? pick(value, TRAVELER_KEYS) : undefined;
  }
  return value;   // scalars, and Image exactly as TripIt returned it
}

/** Only the writable fields of obj, cleaned of read-only sub-fields, in TripIt's order. */
export function writable(kind: Kind, obj: Obj): Obj {
  const fields = kind === "car" ? CAR_FIELDS : LODGING_FIELDS;
  const out: Obj = {};
  for (const field of fields) {
    const v = writableValue(field, obj[field]);
    if (present(v)) out[field] = v;
  }
  return out;
}

/** existing with changes laid over it: nested objects merge key by key, null removes a key, an
 * empty string or undefined leaves the existing value alone. */
function deepMerge(existing: Obj, changes: Obj): Obj {
  const out: Obj = { ...existing };
  for (const [k, v] of Object.entries(changes)) {
    if (v === null) delete out[k];
    else if (v === undefined || v === "") continue;
    else if (isPlain(v) && isPlain(out[k])) out[k] = deepMerge(out[k] as Obj, v);
    else out[k] = v;
  }
  return out;
}

/** The replace payload: the existing object's writable fields with the changes applied.
 *
 * Refuses, naming them, when TripIt returned fields this module neither keeps nor knows to be
 * read-only: a replace would silently wipe them. A display_name TripIt generated is left out, so
 * TripIt keeps generating it; a custom one is kept (a replace without it reverts the name). */
export function mergeReplace(kind: Kind, existing: Obj, changes: Obj): Obj {
  const fields = kind === "car" ? CAR_FIELDS : LODGING_FIELDS;
  const unknown = Object.keys(existing).filter((k) => !fields.includes(k) && !READ_ONLY_FIELDS.has(k));
  for (const [field, value] of Object.entries(existing)) {
    const known = NESTED_KNOWN[field];
    if (!known) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      if (!isPlain(item)) continue;
      for (const k of Object.keys(item)) if (!known.has(k)) unknown.push(`${field}.${k}`);
    }
  }
  if (unknown.length) {
    throw new Error(
      `Not updated: this ${kind === "car" ? "car rental" : "hotel"} has field(s) the TripIt server does not know how ` +
        `to keep (${unknown.sort().join(", ")}), and an update would wipe them. Edit it in the TripIt app instead.`,
    );
  }
  const base: Obj = { ...existing };
  if (base.is_display_name_auto_generated !== "false") delete base.display_name;
  return writable(kind, deepMerge(base, changes));
}

export type ImageSelector = { uuid?: string; url?: string; caption?: string; index?: number; all?: boolean };

/** The documents left after removing the selected one(s), by the tripit library's rules. */
export function remainingImages(images: unknown, sel: ImageSelector): unknown[] {
  const list: Obj[] = images === undefined || images === null ? [] : Array.isArray(images) ? images : [images as Obj];
  if (list.length === 0) throw new Error("No documents found on this object");
  if (sel.all) return [];
  if (sel.uuid) {
    const rest = list.filter((i) => i.uuid !== sel.uuid);
    if (rest.length === list.length) throw new Error(`No document found with UUID ${sel.uuid}`);
    return rest;
  }
  if (sel.url) {
    const rest = list.filter((i) => i.url !== sel.url);
    if (rest.length === list.length) throw new Error(`No document found with URL ${sel.url}`);
    return rest;
  }
  if (sel.caption) {
    const at = list.findIndex((i) => i.caption === sel.caption);
    if (at < 0) throw new Error(`No document found with caption '${sel.caption}'`);
    return list.filter((_, n) => n !== at);
  }
  const at = (sel.index ?? 1) - 1;
  if (at < 0 || at >= list.length) {
    throw new Error(`Document index out of range. Expected 1-${list.length}, got ${sel.index}`);
  }
  return list.filter((_, n) => n !== at);
}
