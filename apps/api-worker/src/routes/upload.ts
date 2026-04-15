import { json } from "../router";
import type { RouteContext } from "../router";
import { ImportJobRepo } from "@cloud-saas-engine/core-data";

const jobRepo = new ImportJobRepo();
import { enqueueImportJob } from "@cloud-saas-engine/core-events";

/**
 * POST /files/upload
 *
 * Accepts either:
 * - multipart/form-data with a "file" field
 * - raw body with ?filename= and ?tenant_id= query params
 *
 * Pipeline: validate → R2 store → D1 job create → Queue enqueue → respond
 */
export async function uploadHandler(ctx: RouteContext): Promise<Response> {
  const { request, env, url } = ctx;

  let filename: string;
  let tenantId: string;
  let fileData: ArrayBuffer;

  const contentType = request.headers.get("Content-Type") || "";

  if (contentType.includes("multipart/form-data")) {
    // --- Multipart upload ---
    const formData = await request.formData();
    const file = formData.get("file") as unknown as File | null;

    if (!file || typeof file === "string") {
      return json({ ok: false, error: "Missing 'file' field in form data" }, 400);
    }
    if (file.size === 0) {
      return json({ ok: false, error: "File is empty" }, 400);
    }

    filename = file.name || "upload.csv";
    tenantId = (formData.get("tenant_id") as string) || url.searchParams.get("tenant_id") || "default";
    fileData = await file.arrayBuffer();
  } else {
    // --- Raw body upload (for curl / programmatic clients) ---
    fileData = await request.arrayBuffer();
    if (fileData.byteLength === 0) {
      return json({ ok: false, error: "Request body is empty" }, 400);
    }

    filename = url.searchParams.get("filename") || "upload.csv";
    tenantId = url.searchParams.get("tenant_id") || "default";
  }

  // Validate CSV extension
  if (!filename.toLowerCase().endsWith(".csv")) {
    return json({ ok: false, error: "Only .csv files are supported" }, 400);
  }

  const jobId = crypto.randomUUID();
  const r2Key = `imports/${tenantId}/${jobId}/${filename}`;

  // 1. Store file in R2
  await env.FILES.put(r2Key, fileData, {
    customMetadata: {
      originalName: filename,
      tenantId,
      uploadedAt: new Date().toISOString(),
    },
  });

  // 2. Create D1 job record
  const job = await jobRepo.create(env.DB, {
    id: jobId,
    tenant_id: tenantId,
    filename,
    r2_key: r2Key,
  });

  // 3. Seed KV cache so status polling works immediately
  await env.CACHE.put(
    `job:${jobId}`,
    JSON.stringify({
      id: jobId,
      status: "pending",
      filename,
      tenant_id: tenantId,
      updated_at: new Date().toISOString(),
    }),
    { expirationTtl: 3600 }
  );

  // 4. Enqueue for async processing
  await enqueueImportJob(env.IMPORT_QUEUE, {
    job_id: jobId,
    tenant_id: tenantId,
    r2_key: r2Key,
    filename,
  });

  return json(
    {
      ok: true,
      data: {
        jobId: job.id,
        fileName: job.filename,
        status: job.status,
      },
    },
    201
  );
}
