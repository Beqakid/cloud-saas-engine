/**
 * Worker environment bindings.
 * Every Cloudflare resource the Worker can access is declared here.
 */
import type { ImportQueueMessage } from "./events";

export interface Env {
  // — Storage —
  DB: D1Database;
  FILES: R2Bucket;
  CACHE: KVNamespace;

  // — Messaging —
  IMPORT_QUEUE: Queue<ImportQueueMessage>;
}
