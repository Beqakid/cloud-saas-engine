// cloud-saas-engine-api Worker — P-04/P-05: Upload + Queue Producer

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders(),
      });
    }

    try {
      // Health
      if (url.pathname === '/' || url.pathname === '/health') {
        return json({
          ok: true,
          service: 'cloud-saas-engine-api',
          timestamp: new Date().toISOString(),
          bindings: { d1: !!env.DB, r2: !!env.FILES, kv: !!env.KV, queue: !!env.IMPORT_QUEUE },
        });
      }

      // POST /files/upload — upload CSV to R2, create job, enqueue
      if (url.pathname === '/files/upload' && method === 'POST') {
        return await handleUpload(request, env);
      }

      // GET /jobs/:id/status — job status from D1
      const jobMatch = url.pathname.match(/^\/jobs\/([^/]+)\/status$/);
      if (jobMatch && method === 'GET') {
        return await handleJobStatus(jobMatch[1], env);
      }

      // GET /jobs — list recent jobs
      if (url.pathname === '/jobs' && method === 'GET') {
        return await handleListJobs(env);
      }

      return json({ error: 'Not Found' }, 404);
    } catch (err) {
      console.error('Request error:', err);
      return json({ error: 'Internal Server Error', message: err.message }, 500);
    }
  },

  async queue(batch, env) {
    for (const msg of batch.messages) {
      try {
        const { jobId, r2Key, tenant_id } = msg.body;
        console.log(`Processing import job ${jobId} from ${r2Key}`);

        // Update job status to processing
        await env.DB.prepare(
          'UPDATE import_jobs SET status = ?, updated_at = datetime(\'now\') WHERE id = ?'
        ).bind('processing', jobId).run();

        // Fetch CSV from R2
        const obj = await env.FILES.get(r2Key);
        if (!obj) {
          await failJob(env, jobId, 'File not found in R2');
          msg.ack();
          continue;
        }

        const csvText = await obj.text();
        const rows = parseCSV(csvText);

        if (rows.length === 0) {
          await failJob(env, jobId, 'CSV file is empty or has no data rows');
          msg.ack();
          continue;
        }

        // Update total_rows
        await env.DB.prepare(
          'UPDATE import_jobs SET total_rows = ?, updated_at = datetime(\'now\') WHERE id = ?'
        ).bind(rows.length, jobId).run();

        // Insert rows in batches of 50
        let processedRows = 0;
        let errorCount = 0;
        const errors = [];

        for (let i = 0; i < rows.length; i += 50) {
          const chunk = rows.slice(i, i + 50);
          const stmts = chunk.map((row, idx) => {
            const rowNum = i + idx + 1;
            return env.DB.prepare(
              'INSERT INTO import_rows (job_id, row_number, raw_data, status) VALUES (?, ?, ?, ?)'
            ).bind(jobId, rowNum, JSON.stringify(row), 'valid');
          });

          try {
            await env.DB.batch(stmts);
            processedRows += chunk.length;
          } catch (batchErr) {
            // Insert individually on batch failure
            for (let j = 0; j < chunk.length; j++) {
              const rowNum = i + j + 1;
              try {
                await env.DB.prepare(
                  'INSERT INTO import_rows (job_id, row_number, raw_data, status) VALUES (?, ?, ?, ?)'
                ).bind(jobId, rowNum, JSON.stringify(chunk[j]), 'valid').run();
                processedRows++;
              } catch (rowErr) {
                errorCount++;
                errors.push({ row: rowNum, error: rowErr.message });
              }
            }
          }

          // Update progress
          await env.DB.prepare(
            'UPDATE import_jobs SET processed_rows = ?, error_count = ?, updated_at = datetime(\'now\') WHERE id = ?'
          ).bind(processedRows, errorCount, jobId).run();
        }

        // Mark complete
        const finalStatus = errorCount > 0 && processedRows === 0 ? 'failed' : 'completed';
        await env.DB.prepare(
          'UPDATE import_jobs SET status = ?, processed_rows = ?, error_count = ?, error_log = ?, updated_at = datetime(\'now\') WHERE id = ?'
        ).bind(finalStatus, processedRows, errorCount, errors.length > 0 ? JSON.stringify(errors) : null, jobId).run();

        // Write status to KV for fast reads
        await env.KV.put(`job:${jobId}:status`, JSON.stringify({
          id: jobId,
          status: finalStatus,
          total_rows: rows.length,
          processed_rows: processedRows,
          error_count: errorCount,
          updated_at: new Date().toISOString(),
        }), { expirationTtl: 86400 });

        console.log(`Job ${jobId} ${finalStatus}: ${processedRows}/${rows.length} rows, ${errorCount} errors`);
        msg.ack();
      } catch (err) {
        console.error('Queue processing error:', err);
        msg.retry();
      }
    }
  },
};

// --- Handlers ---

async function handleUpload(request, env) {
  const contentType = request.headers.get('content-type') || '';

  let file, filename, tenantId;

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    file = formData.get('file');
    filename = file?.name || 'upload.csv';
    tenantId = formData.get('tenant_id') || 'default';

    if (!file) {
      return json({ error: 'Missing file in form data' }, 400);
    }
  } else {
    // Raw body upload
    const url = new URL(request.url);
    filename = url.searchParams.get('filename') || 'upload.csv';
    tenantId = url.searchParams.get('tenant_id') || 'default';
    file = await request.arrayBuffer();
  }

  if (!filename.endsWith('.csv')) {
    return json({ error: 'Only CSV files are supported' }, 400);
  }

  const jobId = crypto.randomUUID();
  const r2Key = `imports/${tenantId}/${jobId}/${filename}`;

  // Upload to R2
  await env.FILES.put(r2Key, file);

  // Create job record in D1
  await env.DB.prepare(
    'INSERT INTO import_jobs (id, tenant_id, filename, r2_key, status) VALUES (?, ?, ?, ?, ?)'
  ).bind(jobId, tenantId, filename, r2Key, 'pending').run();

  // Enqueue for processing
  await env.IMPORT_QUEUE.send({
    jobId,
    r2Key,
    tenant_id: tenantId,
  });

  // Write initial status to KV
  await env.KV.put(`job:${jobId}:status`, JSON.stringify({
    id: jobId,
    status: 'pending',
    total_rows: 0,
    processed_rows: 0,
    error_count: 0,
    updated_at: new Date().toISOString(),
  }), { expirationTtl: 86400 });

  return json({
    ok: true,
    job_id: jobId,
    filename,
    r2_key: r2Key,
    status: 'pending',
    message: 'File uploaded and queued for processing',
  }, 201);
}

async function handleJobStatus(jobId, env) {
  // Try KV first (fast path)
  const cached = await env.KV.get(`job:${jobId}:status`);
  if (cached) {
    return json({ ok: true, source: 'cache', ...JSON.parse(cached) });
  }

  // Fall back to D1
  const job = await env.DB.prepare(
    'SELECT id, tenant_id, filename, status, total_rows, processed_rows, error_count, error_log, created_at, updated_at FROM import_jobs WHERE id = ?'
  ).bind(jobId).first();

  if (!job) {
    return json({ error: 'Job not found' }, 404);
  }

  return json({ ok: true, source: 'db', ...job });
}

async function handleListJobs(env) {
  const { results } = await env.DB.prepare(
    'SELECT id, tenant_id, filename, status, total_rows, processed_rows, error_count, created_at, updated_at FROM import_jobs ORDER BY created_at DESC LIMIT 50'
  ).all();

  return json({ ok: true, jobs: results });
}

// --- Helpers ---

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    rows.push(row);
  }

  return rows;
}

function failJob(env, jobId, errorMessage) {
  return env.DB.prepare(
    'UPDATE import_jobs SET status = ?, error_log = ?, updated_at = datetime(\'now\') WHERE id = ?'
  ).bind('failed', JSON.stringify([{ error: errorMessage }]), jobId).run();
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}
