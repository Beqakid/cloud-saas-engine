import type { Env, ImportQueueMessage, CreateImportRow } from "@cloud-saas-engine/types";
import { ImportJobRepo, ImportRowRepo } from "@cloud-saas-engine/core-data";
import { parseImportMessage } from "@cloud-saas-engine/core-events";

const jobRepo = new ImportJobRepo();
const rowRepo = new ImportRowRepo();

/**
 * Queue consumer — processes import job messages.
 * For each message: fetch CSV from R2 → parse → batch insert to D1 → update job status.
 */
export async function handleQueueBatch(
  batch: MessageBatch,
  env: Env
): Promise<void> {
  for (const msg of batch.messages) {
    const parsed = parseImportMessage(msg as Message<ImportQueueMessage>);

    if (!parsed) {
      // Malformed message — ack to prevent infinite retry
      msg.ack();
      continue;
    }

    await processImportJob(env, parsed);
    msg.ack();
  }
}

async function processImportJob(
  env: Env,
  message: ImportQueueMessage
): Promise<void> {
  const { job_id, r2_key } = message;

  try {
    // 1. Mark job as processing
    await jobRepo.updateStatus(env.DB, job_id, "processing");

    // 2. Fetch CSV from R2
    const obj = await env.FILES.get(r2_key);
    if (!obj) throw new Error(`R2 object not found: ${r2_key}`);
    const csvText = await obj.text();

    // 3. Parse CSV
    const lines = csvText.trim().split("\n");
    if (lines.length < 2) throw new Error("CSV must have a header row and at least one data row");

    const headers = parseCSVLine(lines[0]);
    const rows: CreateImportRow[] = [];
    let errorCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const values = parseCSVLine(line);
        const rowData: Record<string, string> = {};
        headers.forEach((h, idx) => {
          rowData[h.trim()] = (values[idx] || "").trim();
        });

        rows.push({
          job_id,
          row_number: i,
          raw_data: JSON.stringify(rowData),
          status: "imported",
        });
      } catch {
        // Individual row parse failure — record it but keep going
        errorCount++;
        rows.push({
          job_id,
          row_number: i,
          raw_data: line,
          status: "invalid",
        });
      }
    }

    // 4. Batch insert rows
    await rowRepo.batchInsert(env.DB, rows);

    // 5. Update progress in D1 after each batch is done
    const processedRows = rows.length - errorCount;
    await jobRepo.updateStatus(env.DB, job_id, "completed", {
      totalRows: rows.length,
      processedRows,
      errorCount,
    });

    // 6. Write terminal status to KV cache
    await env.CACHE.put(
      `job:${job_id}`,
      JSON.stringify({
        id: job_id,
        status: "completed",
        total_rows: rows.length,
        processed_rows: processedRows,
        error_count: errorCount,
        updated_at: new Date().toISOString(),
      }),
      { expirationTtl: 3600 }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    // Mark job as failed
    await jobRepo.updateStatus(env.DB, job_id, "failed", {
      errorLog: errorMessage,
    });

    // Cache failure
    await env.CACHE.put(
      `job:${job_id}`,
      JSON.stringify({
        id: job_id,
        status: "failed",
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      }),
      { expirationTtl: 3600 }
    );
  }
}

/**
 * Parse a single CSV line, handling quoted fields and escaped quotes.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }

  result.push(current);
  return result;
}
