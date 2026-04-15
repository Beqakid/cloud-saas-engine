/**
 * Queue and event message types.
 * Defines the contract between producers (API routes) and consumers (queue handlers).
 */

/** Message sent to IMPORT_QUEUE when a CSV is uploaded. */
export interface ImportQueueMessage {
  job_id: string;
  tenant_id: string;
  r2_key: string;
  filename: string;
}
