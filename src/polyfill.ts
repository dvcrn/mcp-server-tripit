import { File as NodeFetchFile } from "node-fetch";

// Undici bundled in tripit requires a global File, which Node 18 lacks.
if (typeof globalThis.File === "undefined") {
  (globalThis as unknown as Record<string, unknown>).File = NodeFetchFile;
}
