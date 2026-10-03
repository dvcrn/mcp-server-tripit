import type { TripItClient } from "./client";

// TripIt's object endpoints for the types the tripit library does not cover (car), or covers in a
// way that loses data on update (lodging). Same URLs, body encoding and error text as the
// library's own apiGet/apiPost, with the token from the library client.

export type ObjectType = "car" | "lodging";
type Obj = Record<string, unknown>;

const API = "https://api.tripit.com";

function endpoint(action: string, type: ObjectType, id?: string): string {
  if (id === undefined) return `${API}/v2/${action}/${type}/format/json`;
  const byUuid = id.includes("-");
  return byUuid
    ? `${API}/v2/${action}/${type}/uuid/${encodeURIComponent(id)}/format/json`
    : `${API}/v1/${action}/${type}/id/${encodeURIComponent(id)}/format/json`;
}

async function call(client: TripItClient, url: string, payload?: Obj): Promise<Obj> {
  const headers: Record<string, string> = { Authorization: `Bearer ${client.getAccessToken()}` };
  let init: RequestInit = { headers };
  if (payload !== undefined) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    init = { method: "POST", headers, body: new URLSearchParams({ json: JSON.stringify(payload) }).toString() };
  }
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) throw new Error(`API error (${res.status}): ${text}`);
  const data = JSON.parse(text) as Obj;
  delete data.Profile;   // the traveler profiles TripIt appends are not part of the object
  return data;
}

export function tripitGet(client: TripItClient, type: ObjectType, id: string): Promise<Obj> {
  return call(client, endpoint("get", type, id));
}

export function tripitCreate(client: TripItClient, type: ObjectType, objectKey: string, obj: Obj): Promise<Obj> {
  return call(client, endpoint("create", type), { [objectKey]: obj });
}

export function tripitReplace(client: TripItClient, type: ObjectType, uuid: string, objectKey: string, obj: Obj): Promise<Obj> {
  return call(client, endpoint("replace", type, uuid), { [objectKey]: obj });
}

export function tripitDelete(client: TripItClient, type: ObjectType, id: string): Promise<Obj> {
  return call(client, endpoint("delete", type, id));
}

/** The single object of a get or replace response, e.g. data.CarObject. */
export function theObject(data: Obj, objectKey: string, id: string): Obj {
  const o = data[objectKey];
  const one = Array.isArray(o) ? o[0] : o;
  if (!one || typeof one !== "object" || !(one as Obj).uuid) {
    throw new Error(`No ${objectKey} with identifier ${id}`);
  }
  return one as Obj;
}

/** True when an error only means "this id is not that type": TripIt's 400 ("not a ... object")
 * or 404, or a response without the object. Anything else (auth, rate limit, 5xx, network) is a
 * real failure and must not be read as "try another type". */
export function isWrongType(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  const status = /^API error \((\d{3})\)/.exec(message);
  if (status) {
    const code = Number(status[1]);
    return code === 400 || code === 404;
  }
  return /^No \w+Object with identifier /.test(message);
}

// One read-modify-replace at a time per object. A replace rewrites the whole object from a read,
// so two concurrent updates to one booking would otherwise each restore what the other changed.
// All gateway calls reach this one server process, so an in-process lock covers them; edits made
// in the TripIt app meanwhile cannot be guarded against (TripIt has no conditional replace).
const locks = new Map<string, Promise<unknown>>();

export async function withObjectLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(fn);
  const settled = run.catch(() => undefined);
  locks.set(key, settled);
  try {
    return await run;
  } finally {
    if (locks.get(key) === settled) locks.delete(key);
  }
}

/** Read an object and run fn on it under the lock of its canonical UUID, so a numeric id and the
 * UUID of one object never run concurrently. A UUID locks at once; a numeric id is resolved to its
 * UUID first and the object is re-read inside the lock (the first read may be stale by then). */
export async function withLockedObject<T>(
  client: TripItClient,
  type: ObjectType,
  objectKey: string,
  id: string,
  fn: (existing: Obj) => Promise<T>,
): Promise<T> {
  const uuid = id.includes("-") ? id : String(theObject(await tripitGet(client, type, id), objectKey, id).uuid);
  return withObjectLock(`${type}:${uuid}`, async () => fn(theObject(await tripitGet(client, type, uuid), objectKey, uuid)));
}
