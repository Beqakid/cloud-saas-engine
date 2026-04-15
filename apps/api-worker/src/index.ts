// cloud-saas-engine-api Worker — P-09: Full API + Admin UI
// Serves admin HTML + API endpoints from a single Worker

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // --- ADMIN UI ROUTES ---
      if (path === "/" || path === "/admin" || path === "/admin/") {
        return new Response(ADMIN_HTML, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      // --- API ROUTES ---

      // Health check
      if (path === "/health") {
        return json({ ok: true, service: "cloud-saas-engine-api", bindings: { d1: !!env.DB, r2: !!env.FILES, kv: !!env.KV, queue: !!env.IMPORT_QUEUE } }, corsHeaders);
      }

      // Upload CSV
      if (path === "/files/upload" && request.method === "POST") {
        const filename = url.searchParams.get("filename") || "upload.csv";
        const tenantId = url.searchParams.get("tenant_id") || "default";
        const jobId = crypto.randomUUID();
        const r2Key = `imports/${tenantId}/${jobId}/${filename}`;

        // Store in R2
        const body = await request.arrayBuffer();
        await env.FILES.put(r2Key, body);

        // Create D1 job record
        await env.DB.prepare(
          `INSERT INTO import_jobs (id, tenant_id, filename, r2_key, status, total_rows, processed_rows, error_count)
           VALUES (?, ?, ?, ?, 'pending', 0, 0, 0)`
        ).bind(jobId, tenantId, filename, r2Key).run();

        // Enqueue
        await env.IMPORT_QUEUE.send({ job_id: jobId, tenant_id: tenantId, r2_key: r2Key, filename });

        // Cache initial status
        await env.KV.put(`job:${jobId}`, JSON.stringify({ id: jobId, status: "pending", total_rows: 0, processed_rows: 0, error_count: 0, updated_at: new Date().toISOString() }), { expirationTtl: 3600 });

        return json({ ok: true, job_id: jobId, filename, r2_key: r2Key, status: "pending", message: "File uploaded and queued for processing" }, corsHeaders);
      }

      // Job status
      if (path.match(/^\/jobs\/[^/]+\/status$/) && request.method === "GET") {
        const jobId = path.split("/")[2];

        // Try KV cache first
        const cached = await env.KV.get(`job:${jobId}`);
        if (cached) {
          const data = JSON.parse(cached);
          if (data.status === "completed" || data.status === "failed") {
            return json({ ok: true, source: "cache", ...data }, corsHeaders);
          }
        }

        // Fall back to D1
        const row = await env.DB.prepare("SELECT * FROM import_jobs WHERE id = ?").bind(jobId).first();
        if (!row) return json({ ok: false, error: "Job not found" }, corsHeaders, 404);

        // Update cache
        const status = { id: row.id, status: row.status, total_rows: row.total_rows, processed_rows: row.processed_rows, error_count: row.error_count, updated_at: row.updated_at };
        await env.KV.put(`job:${jobId}`, JSON.stringify(status), { expirationTtl: 3600 });

        return json({ ok: true, source: "d1", ...status }, corsHeaders);
      }

      // Job rows (new: see parsed rows)
      if (path.match(/^\/jobs\/[^/]+\/rows$/) && request.method === "GET") {
        const jobId = path.split("/")[2];
        const limit = parseInt(url.searchParams.get("limit") || "100");
        const offset = parseInt(url.searchParams.get("offset") || "0");
        const rows = await env.DB.prepare("SELECT * FROM import_rows WHERE job_id = ? ORDER BY row_number LIMIT ? OFFSET ?").bind(jobId, limit, offset).all();
        return json({ ok: true, job_id: jobId, rows: rows.results, count: rows.results.length }, corsHeaders);
      }

      // List jobs
      if (path === "/jobs" && request.method === "GET") {
        const tenantId = url.searchParams.get("tenant_id");
        let query = "SELECT * FROM import_jobs ORDER BY created_at DESC LIMIT 50";
        let stmt = env.DB.prepare(query);
        if (tenantId) {
          query = "SELECT * FROM import_jobs WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 50";
          stmt = env.DB.prepare(query).bind(tenantId);
        }
        const result = await stmt.all();
        return json({ ok: true, jobs: result.results }, corsHeaders);
      }

      return json({ ok: false, error: "Not found" }, corsHeaders, 404);
    } catch (err) {
      return json({ ok: false, error: err.message }, corsHeaders, 500);
    }
  },

  async queue(batch, env) {
    for (const msg of batch.messages) {
      const { job_id, r2_key } = msg.body;
      try {
        // Update status to processing
        await env.DB.prepare("UPDATE import_jobs SET status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(job_id).run();

        // Fetch CSV from R2
        const obj = await env.FILES.get(r2_key);
        if (!obj) throw new Error(`R2 object not found: ${r2_key}`);
        const csvText = await obj.text();

        // Parse CSV
        const lines = csvText.trim().split("\n");
        const headers = parseCSVLine(lines[0]);
        const rows = [];
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          const values = parseCSVLine(lines[i]);
          const row = {};
          headers.forEach((h, idx) => { row[h.trim()] = (values[idx] || "").trim(); });
          rows.push({ row_number: i, data: row });
        }

        // Batch insert rows — include job status update in the same D1 batch
        const BATCH = 50;
        let processed = 0;
        for (let i = 0; i < rows.length; i += BATCH) {
          const chunk = rows.slice(i, i + BATCH);
          const stmts = chunk.map(r =>
            env.DB.prepare("INSERT OR REPLACE INTO import_rows (job_id, row_number, raw_data, status) VALUES (?, ?, ?, 'imported')")
              .bind(job_id, r.row_number, JSON.stringify(r.data))
          );
          processed += chunk.length;
          // Include progress update in the same batch for atomicity
          stmts.push(
            env.DB.prepare("UPDATE import_jobs SET total_rows = ?, processed_rows = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
              .bind(rows.length, processed, job_id)
          );
          await env.DB.batch(stmts);
        }

        // Mark complete in its own statement
        await env.DB.prepare("UPDATE import_jobs SET status = 'completed', total_rows = ?, processed_rows = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(rows.length, processed, job_id).run();

        // Update KV cache
        await env.KV.put(`job:${job_id}`, JSON.stringify({ id: job_id, status: "completed", total_rows: rows.length, processed_rows: processed, error_count: 0, updated_at: new Date().toISOString() }), { expirationTtl: 3600 });

        msg.ack();
      } catch (err) {
        await env.DB.prepare("UPDATE import_jobs SET status = 'failed', error_log = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(err.message, job_id).run();
        await env.KV.put(`job:${job_id}`, JSON.stringify({ id: job_id, status: "failed", error_message: err.message, updated_at: new Date().toISOString() }), { expirationTtl: 3600 });
        msg.ack();
      }
    }
  }
};

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { result.push(current); current = ""; }
      else { current += ch; }
    }
  }
  result.push(current);
  return result;
}

function json(data, corsHeaders, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });
}

// --- ADMIN UI HTML ---
const ADMIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cloud SaaS Engine — Admin</title>
<style>
  :root { --bg: #0f172a; --card: #1e293b; --border: #334155; --text: #e2e8f0; --muted: #94a3b8; --accent: #3b82f6; --green: #22c55e; --red: #ef4444; --yellow: #eab308; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }
  .container { max-width: 900px; margin: 0 auto; padding: 2rem 1rem; }
  h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
  .subtitle { color: var(--muted); font-size: 0.875rem; margin-bottom: 2rem; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1.5rem; margin-bottom: 1.5rem; }
  .card h2 { font-size: 1rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }
  .upload-zone { border: 2px dashed var(--border); border-radius: 0.5rem; padding: 2rem; text-align: center; cursor: pointer; transition: all 0.2s; }
  .upload-zone:hover, .upload-zone.drag { border-color: var(--accent); background: rgba(59,130,246,0.05); }
  .upload-zone input { display: none; }
  .upload-zone p { color: var(--muted); margin-top: 0.5rem; font-size: 0.875rem; }
  .btn { background: var(--accent); color: white; border: none; padding: 0.625rem 1.25rem; border-radius: 0.5rem; cursor: pointer; font-size: 0.875rem; font-weight: 500; transition: opacity 0.2s; }
  .btn:hover { opacity: 0.9; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-sm { padding: 0.375rem 0.75rem; font-size: 0.75rem; }
  table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
  th { text-align: left; color: var(--muted); font-weight: 500; padding: 0.625rem 0.75rem; border-bottom: 1px solid var(--border); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
  td { padding: 0.625rem 0.75rem; border-bottom: 1px solid var(--border); }
  tr:last-child td { border-bottom: none; }
  .badge { display: inline-block; padding: 0.125rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; }
  .badge-pending { background: rgba(234,179,8,0.15); color: var(--yellow); }
  .badge-processing { background: rgba(59,130,246,0.15); color: var(--accent); }
  .badge-completed { background: rgba(34,197,94,0.15); color: var(--green); }
  .badge-failed { background: rgba(239,68,68,0.15); color: var(--red); }
  .progress-bar { width: 100%; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
  .progress-fill { height: 100%; background: var(--green); border-radius: 3px; transition: width 0.3s; }
  .file-name { display: flex; align-items: center; gap: 0.5rem; margin: 1rem 0; padding: 0.75rem; background: rgba(59,130,246,0.08); border-radius: 0.5rem; font-size: 0.875rem; }
  .toast { position: fixed; bottom: 1.5rem; right: 1.5rem; padding: 0.75rem 1.25rem; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 500; z-index: 50; animation: fadeIn 0.3s; }
  .toast-success { background: var(--green); color: white; }
  .toast-error { background: var(--red); color: white; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .empty { text-align: center; color: var(--muted); padding: 2rem; font-size: 0.875rem; }
  .rows-preview { margin-top: 1rem; max-height: 300px; overflow: auto; }
  .rows-preview table { font-size: 0.8rem; }
  .mono { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.8rem; }
  .spin { animation: spin 1s linear infinite; display: inline-block; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
<div class="container">
  <h1>☁️ Cloud SaaS Engine</h1>
  <p class="subtitle">Admin Console — CSV Import Pipeline</p>

  <!-- Upload Card -->
  <div class="card">
    <h2>📤 Upload CSV</h2>
    <div class="upload-zone" id="dropZone" onclick="document.getElementById('fileInput').click()">
      <input type="file" id="fileInput" accept=".csv">
      <div>📁 <strong>Click to browse</strong> or drag & drop</div>
      <p>Accepts .csv files</p>
    </div>
    <div id="fileInfo" style="display:none">
      <div class="file-name">
        <span>📄</span>
        <span id="fileName"></span>
        <span id="fileSize" style="color:var(--muted)"></span>
      </div>
      <div style="display:flex;gap:0.75rem;align-items:center">
        <label style="font-size:0.875rem;color:var(--muted)">Tenant:</label>
        <input id="tenantInput" value="church-demo" style="background:var(--bg);border:1px solid var(--border);color:var(--text);padding:0.375rem 0.75rem;border-radius:0.375rem;font-size:0.875rem;flex:1">
        <button class="btn" id="uploadBtn" onclick="uploadFile()">Upload & Process</button>
      </div>
    </div>
  </div>

  <!-- Active Job Card (shown during polling) -->
  <div class="card" id="activeJobCard" style="display:none">
    <h2>⚡ Active Import</h2>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">
      <span id="activeJobName" class="mono"></span>
      <span id="activeJobBadge" class="badge"></span>
    </div>
    <div class="progress-bar"><div class="progress-fill" id="activeProgress"></div></div>
    <div style="display:flex;justify-content:space-between;margin-top:0.5rem">
      <span id="activeCount" style="font-size:0.8rem;color:var(--muted)"></span>
      <span id="activePercent" style="font-size:0.8rem;color:var(--muted)"></span>
    </div>
  </div>

  <!-- Jobs Table -->
  <div class="card">
    <h2>📋 Import Jobs <button class="btn btn-sm" onclick="loadJobs()" style="margin-left:auto">Refresh</button></h2>
    <div id="jobsTable"></div>
  </div>

  <!-- Row Preview (shown when clicking a job) -->
  <div class="card" id="rowsCard" style="display:none">
    <h2>🔍 Row Preview — <span id="rowsJobId" class="mono"></span></h2>
    <div id="rowsTable" class="rows-preview"></div>
  </div>
</div>

<div id="toast" class="toast" style="display:none"></div>

<script>
const API = location.origin;
let selectedFile = null;
let pollTimer = null;

// --- File Selection ---
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');

fileInput.addEventListener('change', (e) => { if (e.target.files[0]) selectFile(e.target.files[0]); });
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag'));
dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('drag'); if (e.dataTransfer.files[0]) selectFile(e.dataTransfer.files[0]); });

function selectFile(file) {
  selectedFile = file;
  document.getElementById('fileName').textContent = file.name;
  document.getElementById('fileSize').textContent = formatBytes(file.size);
  document.getElementById('fileInfo').style.display = 'block';
}

// --- Upload ---
async function uploadFile() {
  if (!selectedFile) return;
  const btn = document.getElementById('uploadBtn');
  btn.disabled = true; btn.textContent = 'Uploading...';
  const tenant = document.getElementById('tenantInput').value || 'default';

  try {
    const res = await fetch(API + '/files/upload?filename=' + encodeURIComponent(selectedFile.name) + '&tenant_id=' + encodeURIComponent(tenant), {
      method: 'POST', headers: { 'Content-Type': 'text/csv' }, body: selectedFile
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    showToast('Uploaded! Processing...', 'success');
    btn.textContent = 'Upload & Process'; btn.disabled = false;
    selectedFile = null;
    document.getElementById('fileInfo').style.display = 'none';
    fileInput.value = '';

    // Start polling this job
    startPolling(data.job_id, data.filename);
    loadJobs();
  } catch (err) {
    showToast('Upload failed: ' + err.message, 'error');
    btn.textContent = 'Upload & Process'; btn.disabled = false;
  }
}

// --- Polling ---
function startPolling(jobId, filename) {
  const card = document.getElementById('activeJobCard');
  card.style.display = 'block';
  document.getElementById('activeJobName').textContent = filename || jobId;
  updateActiveJob({ status: 'pending', total_rows: 0, processed_rows: 0 });

  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    try {
      const res = await fetch(API + '/jobs/' + jobId + '/status');
      const data = await res.json();
      if (!data.ok) return;
      updateActiveJob(data);
      if (data.status === 'completed' || data.status === 'failed') {
        clearInterval(pollTimer); pollTimer = null;
        loadJobs();
        if (data.status === 'completed') showToast('Import complete! ' + data.processed_rows + ' rows imported', 'success');
        if (data.status === 'failed') showToast('Import failed', 'error');
        setTimeout(() => { card.style.display = 'none'; }, 5000);
      }
    } catch(e) {}
  }, 2000);
}

function updateActiveJob(data) {
  const badge = document.getElementById('activeJobBadge');
  badge.textContent = data.status;
  badge.className = 'badge badge-' + data.status;
  const pct = data.total_rows > 0 ? Math.round((data.processed_rows / data.total_rows) * 100) : (data.status === 'pending' ? 0 : 100);
  document.getElementById('activeProgress').style.width = pct + '%';
  document.getElementById('activeCount').textContent = data.processed_rows + ' / ' + data.total_rows + ' rows';
  document.getElementById('activePercent').textContent = pct + '%';
}

// --- Jobs List ---
async function loadJobs() {
  try {
    const res = await fetch(API + '/jobs');
    const data = await res.json();
    if (!data.ok || !data.jobs.length) {
      document.getElementById('jobsTable').innerHTML = '<div class="empty">No import jobs yet. Upload a CSV to get started.</div>';
      return;
    }
    let html = '<table><thead><tr><th>File</th><th>Tenant</th><th>Status</th><th>Rows</th><th>Created</th><th></th></tr></thead><tbody>';
    for (const j of data.jobs) {
      const pct = j.total_rows > 0 ? Math.round((j.processed_rows/j.total_rows)*100) : 0;
      html += '<tr>' +
        '<td class="mono">' + esc(j.filename) + '</td>' +
        '<td>' + esc(j.tenant_id) + '</td>' +
        '<td><span class="badge badge-' + j.status + '">' + j.status + '</span></td>' +
        '<td>' + j.processed_rows + '/' + j.total_rows + (j.error_count > 0 ? ' <span style="color:var(--red)">(' + j.error_count + ' err)</span>' : '') + '</td>' +
        '<td style="color:var(--muted);font-size:0.8rem">' + timeAgo(j.created_at) + '</td>' +
        '<td><button class="btn btn-sm" onclick="viewRows(\\'' + j.id + '\\')">View</button></td>' +
        '</tr>';
    }
    html += '</tbody></table>';
    document.getElementById('jobsTable').innerHTML = html;
  } catch(e) {
    document.getElementById('jobsTable').innerHTML = '<div class="empty">Failed to load jobs</div>';
  }
}

// --- Row Preview ---
async function viewRows(jobId) {
  document.getElementById('rowsCard').style.display = 'block';
  document.getElementById('rowsJobId').textContent = jobId.substring(0, 8) + '...';
  document.getElementById('rowsTable').innerHTML = '<div class="empty">Loading...</div>';
  try {
    const res = await fetch(API + '/jobs/' + jobId + '/rows?limit=50');
    const data = await res.json();
    if (!data.ok || !data.rows.length) {
      document.getElementById('rowsTable').innerHTML = '<div class="empty">No rows found</div>';
      return;
    }
    // Parse first row to get column headers
    const cols = Object.keys(JSON.parse(data.rows[0].raw_data));
    let html = '<table><thead><tr><th>#</th>';
    cols.forEach(c => html += '<th>' + esc(c) + '</th>');
    html += '<th>Status</th></tr></thead><tbody>';
    for (const r of data.rows) {
      const d = JSON.parse(r.raw_data);
      html += '<tr><td>' + r.row_number + '</td>';
      cols.forEach(c => html += '<td>' + esc(d[c] || '') + '</td>');
      html += '<td><span class="badge badge-completed">' + r.status + '</span></td></tr>';
    }
    html += '</tbody></table>';
    document.getElementById('rowsTable').innerHTML = html;
  } catch(e) {
    document.getElementById('rowsTable').innerHTML = '<div class="empty">Failed to load rows</div>';
  }
}

// --- Helpers ---
function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast toast-' + type; t.style.display = 'block';
  setTimeout(() => t.style.display = 'none', 4000);
}
function formatBytes(b) { if (b < 1024) return b + ' B'; if (b < 1048576) return (b/1024).toFixed(1) + ' KB'; return (b/1048576).toFixed(1) + ' MB'; }
function timeAgo(ts) {
  const d = new Date(ts.includes('T') ? ts : ts + 'Z');
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s/60) + 'm ago';
  if (s < 86400) return Math.floor(s/3600) + 'h ago'; return Math.floor(s/86400) + 'd ago';
}
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// Load on start
loadJobs();
</script>
</body>
</html>`;
