import type { ImportQueueMessage } from "@cloud-saas-engine/types";

/**
 * Enqueue an import job for async processing.
 * Serializes the message as JSON and sends it to the Cloudflare Queue.
 */
export async function enqueueImportJob(
  queue: Queue<ImportQueueMessage>,
  message: ImportQueueMessage
): Promise<void> {
  await queue.send(message);
}

/**
 * Parse and validate an incoming queue message.
 * Returns the typed message or null if malformed (caller should ack and skip).
 */
export function parseImportMessage(
  raw: Message<ImportQueueMessage>
): ImportQueueMessage | null {
  try {
    const body = raw.body;

    if (
      typeof body !== "object" ||
      body === null ||
      typeof body.job_id !== "string" ||
      typeof body.tenant_id !== "string" ||
      typeof body.r2_key !== "string" ||
      typeof body.filename !== "string"
    ) {
      console.error("Malformed queue message — missing required fields", body);
      return null;
    }

    return {
      job_id: body.job_id,
      tenant_id: body.tenant_id,
      r2_key: body.r2_key,
      filename: body.filename,
    };
  } catch (err) {
    console.error("Failed to parse queue message", err);
    return null;
  }
}
