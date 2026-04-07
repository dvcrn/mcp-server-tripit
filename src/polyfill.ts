// Node.js v18 does not expose `File` as a global; polyfill it so bundled
// packages (e.g. undici inside tripit) can find it at import time.
// This file must be imported before any other module that may reference `File`.
import { File as NodeFetchFile } from "node-fetch";

if (typeof globalThis.File === "undefined") {
  (globalThis as unknown as Record<string, unknown>).File = NodeFetchFile;
}
