import type { RouteContext } from "../router";

/**
 * GET / — Serve the Admin Console HTML.
 * Inline HTML for zero-dependency deployment (no build step, no CDN).
 */
export function adminHandler(_ctx: RouteContext): Response {
  return new Response(ADMIN_HTML, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

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
  .container { max-width: 960px; margin: 0 auto; padding: 2rem 1rem; }
  h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
  .subtitle { color: var(--muted); font-size: 0.875rem; margin-bottom: 1.5rem; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1.5rem; margin-bottom: 1.5rem; }
  .card h2 { font-size: 1rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }
  table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
  th { text-align: left; color: var(--muted); font-weight: 500; padding: 0.625rem 0.75rem; border-bottom: 1px solid var(--border); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
  td { padding: 0.625rem 0.75rem; border-bottom: 1px solid var(--border); }
  tr:last-child td { border-bottom: none; }
  .badge { display: inline-block; padding: 0.125rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; }
  .badge-pending { background: rgba(234,179,8,0.15); color: var(--yellow); }
  .badge-processing { background: rgba(59,130,246,0.15); color: var(--accent); }
  .badge-completed { background: rgba(34,197,94,0.15); color: var(--green); }
  .badge-failed { background: rgba(239,68,68,0.15); color: var(--red); }
  .btn { background: var(--accent); color: white; border: none; padding: 0.625rem 1.25rem; border-radius: 0.5rem; cursor: pointer; font-size: 0.875rem; font-weight: 500; transition: opacity 0.2s; }
  .btn:hover { opacity: 0.9; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-sm { padding: 0.375rem 0.75rem; font-size: 0.75rem; }
  .btn-danger { background: var(--red); }
  .btn-outline { background: transparent; border: 1px solid var(--border); color: var(--text); }
  .btn-outline:hover { border-color: var(--accent); }
  input, select { background: var(--bg); border: 1px solid var(--border); color: var(--text); padding: 0.5rem 0.75rem; border-radius: 0.375rem; font-size: 0.875rem; }
  input:focus, select:focus { outline: none; border-color: var(--accent); }
  .upload-zone { border: 2px dashed var(--border); border-radius: 0.5rem; padding: 2rem; text-align: center; cursor: pointer; transition: all 0.2s; }
  .upload-zone:hover, .upload-zone.drag { border-color: var(--accent); background: rgba(59,130,246,0.05); }
  .upload-zone input { display: none; }
  .upload-zone p { color: var(--muted); margin-top: 0.5rem; font-size: 0.875rem; }
  .progress-bar { width: 100%; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
  .progress-fill { height: 100%; background: var(--green); border-radius: 3px; transition: width 0.3s; }
  .file-name { display: flex; align-items: center; gap: 0.5rem; margin: 1rem 0; padding: 0.75rem; background: rgba(59,130,246,0.08); border-radius: 0.5rem; font-size: 0.875rem; }
  .empty { text-align: center; color: var(--muted); padding: 2rem; font-size: 0.875rem; }
  .mono { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.8rem; }
  .rows-preview { margin-top: 1rem; max-height: 300px; overflow: auto; }
  .rows-preview table { font-size: 0.8rem; }
  .toast { position: fixed; bottom: 1.5rem; right: 1.5rem; padding: 0.75rem 1.25rem; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 500; z-index: 50; animation: fadeIn 0.3s; }
  .toast-success { background: var(--green); color: white; }
  .toast-error { background: var(--red); color: white; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

  /* Tabs */
  .tabs { display: flex; gap: 0; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem; }
  .tab { padding: 0.75rem 1.25rem; cursor: pointer; font-size: 0.875rem; font-weight: 500; color: var(--muted); border-bottom: 2px solid transparent; transition: all 0.2s; }
  .tab:hover { color: var(--text); }
  .tab.active { color: var(--accent); border-bottom-color: var(--accent); }
  .tab-panel { display: none; }
  .tab-panel.active { display: block; }

  /* Stats */
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
  .stat { background: var(--card); border: 1px solid var(--border); border-radius: 0.5rem; padding: 1rem; text-align: center; }
  .stat-value { font-size: 1.5rem; font-weight: 700; }
  .stat-label { font-size: 0.75rem; color: var(--muted); text-transform: uppercase; margin-top: 0.25rem; }

  /* Modal */
  .modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 100; align-items: center; justify-content: center; }
  .modal-overlay.open { display: flex; }
  .modal { background: var(--card); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1.5rem; width: 90%; max-width: 480px; }
  .modal h3 { margin-bottom: 1rem; }
  .form-row { display: flex; flex-direction: column; gap: 0.25rem; margin-bottom: 0.75rem; }
  .form-row label { font-size: 0.75rem; color: var(--muted); text-transform: uppercase; }
  .form-row input { width: 100%; }
  .form-actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1rem; }
  .amount { color: var(--green); font-weight: 600; }
</style>
</head>
<body>
<div class="container">
  <h1>☁️ Cloud SaaS Engine</h1>
  <p class="subtitle">Church Donations Admin Console</p>

  <div class="tabs">
    <div class="tab active" onclick="switchTab('imports')">📤 Imports</div>
    <div class="tab" onclick="switchTab('donors')">👥 Donors</div>
    <div class="tab" onclick="switchTab('donations')">💰 Donations</div>
    <div class="tab" onclick="switchTab('funds')">🏷️ Funds</div>
  </div>

  <!-- ═══ IMPORTS TAB ═══ -->
  <div class="tab-panel active" id="panel-imports">
    <div class="card">
      <h2>📤 Upload CSV</h2>
      <div class="upload-zone" id="dropZone" onclick="document.getElementById('fileInput').click()">
        <input type="file" id="fileInput" accept=".csv">
        <div>📁 <strong>Click to browse</strong> or drag & drop</div>
        <p>Accepts .csv files (name, email, amount, date, fund columns)</p>
      </div>
      <div id="fileInfo" style="display:none">
        <div class="file-name"><span>📄</span><span id="fileName"></span><span id="fileSize" style="color:var(--muted)"></span></div>
        <div style="display:flex;gap:0.75rem;align-items:center">
          <label style="font-size:0.875rem;color:var(--muted)">Tenant:</label>
          <input id="tenantInput" value="church-demo" style="flex:1">
          <button class="btn" id="uploadBtn" onclick="uploadFile()">Upload & Process</button>
        </div>
      </div>
    </div>
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
    <div class="card">
      <h2>📋 Import Jobs <button class="btn btn-sm" onclick="loadJobs()" style="margin-left:auto">Refresh</button></h2>
      <div id="jobsTable"></div>
    </div>
    <div class="card" id="rowsCard" style="display:none">
      <h2>🔍 Row Preview — <span id="rowsJobId" class="mono"></span></h2>
      <div id="rowsTable" class="rows-preview"></div>
    </div>
  </div>

  <!-- ═══ DONORS TAB ═══ -->
  <div class="tab-panel" id="panel-donors">
    <div class="stats" id="donorStats"></div>
    <div class="card">
      <h2>👥 Donors <button class="btn btn-sm" onclick="openDonorForm()" style="margin-left:auto">+ Add Donor</button></h2>
      <div id="donorsTable"></div>
    </div>
  </div>

  <!-- ═══ DONATIONS TAB ═══ -->
  <div class="tab-panel" id="panel-donations">
    <div class="stats" id="donationStats"></div>
    <div class="card">
      <h2>💰 Donations <button class="btn btn-sm" onclick="openDonationForm()" style="margin-left:auto">+ Add Donation</button></h2>
      <div style="display:flex;gap:0.75rem;margin-bottom:1rem;flex-wrap:wrap">
        <input type="date" id="filterFrom" placeholder="From">
        <input type="date" id="filterTo" placeholder="To">
        <select id="filterFund"><option value="">All Funds</option></select>
        <button class="btn btn-sm" onclick="loadDonations()">Filter</button>
      </div>
      <div id="donationsTable"></div>
    </div>
  </div>

  <!-- ═══ FUNDS TAB ═══ -->
  <div class="tab-panel" id="panel-funds">
    <div class="card">
      <h2>🏷️ Funds <button class="btn btn-sm" onclick="openFundForm()" style="margin-left:auto">+ Add Fund</button></h2>
      <div id="fundsTable"></div>
    </div>
  </div>
</div>

<!-- ═══ MODALS ═══ -->
<div class="modal-overlay" id="donorModal">
  <div class="modal">
    <h3 id="donorModalTitle">Add Donor</h3>
    <input type="hidden" id="donorEditId">
    <div class="form-row"><label>Name *</label><input id="donorName"></div>
    <div class="form-row"><label>Email</label><input id="donorEmail" type="email"></div>
    <div class="form-row"><label>Phone</label><input id="donorPhone"></div>
    <div class="form-row"><label>Address</label><input id="donorAddress"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem">
      <div class="form-row"><label>City</label><input id="donorCity"></div>
      <div class="form-row"><label>State</label><input id="donorState"></div>
      <div class="form-row"><label>Zip</label><input id="donorZip"></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-outline" onclick="closeModal('donorModal')">Cancel</button>
      <button class="btn" onclick="saveDonor()">Save</button>
    </div>
  </div>
</div>

<div class="modal-overlay" id="donationModal">
  <div class="modal">
    <h3>Add Donation</h3>
    <div class="form-row"><label>Donor *</label><select id="donationDonor" style="width:100%"></select></div>
    <div class="form-row"><label>Amount *</label><input id="donationAmount" type="number" step="0.01" min="0.01"></div>
    <div class="form-row"><label>Date *</label><input id="donationDate" type="date"></div>
    <div class="form-row"><label>Fund</label><select id="donationFund" style="width:100%"><option value="">None</option></select></div>
    <div class="form-row"><label>Method</label><select id="donationMethod" style="width:100%"><option value="">—</option><option>cash</option><option>check</option><option>card</option><option>ach</option><option>other</option></select></div>
    <div class="form-row"><label>Check #</label><input id="donationCheck"></div>
    <div class="form-row"><label>Notes</label><input id="donationNotes"></div>
    <div class="form-actions">
      <button class="btn btn-outline" onclick="closeModal('donationModal')">Cancel</button>
      <button class="btn" onclick="saveDonation()">Save</button>
    </div>
  </div>
</div>

<div class="modal-overlay" id="fundModal">
  <div class="modal">
    <h3 id="fundModalTitle">Add Fund</h3>
    <input type="hidden" id="fundEditId">
    <div class="form-row"><label>Name *</label><input id="fundName"></div>
    <div class="form-row"><label>Description</label><input id="fundDesc"></div>
    <div class="form-actions">
      <button class="btn btn-outline" onclick="closeModal('fundModal')">Cancel</button>
      <button class="btn" onclick="saveFund()">Save</button>
    </div>
  </div>
</div>

<div id="toast" class="toast" style="display:none"></div>

<script>
const API = location.origin;
const TENANT = 'church-demo';
let selectedFile = null;
let pollTimer = null;
let allDonors = [];
let allFunds = [];

// ═══ TABS ═══
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById('panel-' + name).classList.add('active');

  if (name === 'donors') loadDonors();
  if (name === 'donations') loadDonations();
  if (name === 'funds') loadFunds();
}

// ═══ IMPORTS (unchanged logic) ═══
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

async function uploadFile() {
  if (!selectedFile) return;
  const btn = document.getElementById('uploadBtn');
  btn.disabled = true; btn.textContent = 'Uploading...';
  const tenant = document.getElementById('tenantInput').value || 'default';
  try {
    const fd = new FormData();
    fd.append('file', selectedFile);
    fd.append('tenant_id', tenant);
    const res = await fetch(API + '/files/upload', { method: 'POST', body: fd });
    const result = await res.json();
    if (!result.ok) throw new Error(result.error);
    showToast('Uploaded! Processing...', 'success');
    btn.textContent = 'Upload & Process'; btn.disabled = false;
    selectedFile = null;
    document.getElementById('fileInfo').style.display = 'none';
    fileInput.value = '';
    startPolling(result.data.jobId, result.data.fileName);
    loadJobs();
  } catch (err) {
    showToast('Upload failed: ' + err.message, 'error');
    btn.textContent = 'Upload & Process'; btn.disabled = false;
  }
}

function startPolling(jobId, filename) {
  const card = document.getElementById('activeJobCard');
  card.style.display = 'block';
  document.getElementById('activeJobName').textContent = filename || jobId;
  updateActiveJob({ status: 'pending', total_rows: 0, processed_rows: 0 });
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    try {
      const res = await fetch(API + '/jobs/' + jobId + '/status');
      const result = await res.json();
      if (!result.ok) return;
      const d = result.data;
      updateActiveJob(d);
      if (d.status === 'completed' || d.status === 'failed') {
        clearInterval(pollTimer); pollTimer = null;
        loadJobs();
        if (d.status === 'completed') showToast('Import complete! Donors & donations created.', 'success');
        if (d.status === 'failed') showToast('Import failed', 'error');
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

async function loadJobs() {
  try {
    const res = await fetch(API + '/jobs');
    const result = await res.json();
    const jobs = result.data || [];
    if (!result.ok || !jobs.length) {
      document.getElementById('jobsTable').innerHTML = '<div class="empty">No import jobs yet. Upload a CSV to get started.</div>';
      return;
    }
    let html = '<table><thead><tr><th>File</th><th>Status</th><th>Rows</th><th>Created</th><th></th></tr></thead><tbody>';
    for (const j of jobs) {
      html += '<tr><td class="mono">' + esc(j.filename) + '</td>' +
        '<td><span class="badge badge-' + j.status + '">' + j.status + '</span></td>' +
        '<td>' + j.processed_rows + '/' + j.total_rows + (j.error_count > 0 ? ' <span style="color:var(--red)">(' + j.error_count + ' err)</span>' : '') + '</td>' +
        '<td style="color:var(--muted);font-size:0.8rem">' + timeAgo(j.created_at) + '</td>' +
        "<td><button class='btn btn-sm' onclick=\\"viewRows('" + j.id + "')\\">View</button></td></tr>";
    }
    html += '</tbody></table>';
    document.getElementById('jobsTable').innerHTML = html;
  } catch(e) {
    document.getElementById('jobsTable').innerHTML = '<div class="empty">Failed to load jobs</div>';
  }
}

async function viewRows(jobId) {
  document.getElementById('rowsCard').style.display = 'block';
  document.getElementById('rowsJobId').textContent = jobId.substring(0, 8) + '...';
  document.getElementById('rowsTable').innerHTML = '<div class="empty">Loading...</div>';
  try {
    const res = await fetch(API + '/jobs/' + jobId + '/rows?limit=50');
    const result = await res.json();
    const rows = result.data ? result.data.rows : [];
    if (!rows.length) { document.getElementById('rowsTable').innerHTML = '<div class="empty">No rows</div>'; return; }
    const cols = Object.keys(JSON.parse(rows[0].raw_data));
    let html = '<table><thead><tr><th>#</th>';
    cols.forEach(c => html += '<th>' + esc(c) + '</th>');
    html += '<th>Status</th></tr></thead><tbody>';
    for (const r of rows) {
      const d = JSON.parse(r.raw_data);
      html += '<tr><td>' + r.row_number + '</td>';
      cols.forEach(c => html += '<td>' + esc(d[c] || '') + '</td>');
      html += '<td><span class="badge badge-completed">' + r.status + '</span></td></tr>';
    }
    html += '</tbody></table>';
    document.getElementById('rowsTable').innerHTML = html;
  } catch(e) { document.getElementById('rowsTable').innerHTML = '<div class="empty">Error loading rows</div>'; }
}

// ═══ DONORS ═══
async function loadDonors() {
  try {
    const res = await fetch(API + '/donors?tenant_id=' + TENANT);
    const result = await res.json();
    allDonors = result.data || [];
    document.getElementById('donorStats').innerHTML =
      '<div class="stat"><div class="stat-value">' + allDonors.length + '</div><div class="stat-label">Total Donors</div></div>';

    if (!allDonors.length) {
      document.getElementById('donorsTable').innerHTML = '<div class="empty">No donors yet. Import a CSV or add manually.</div>';
      return;
    }
    let html = '<table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>City/State</th><th></th></tr></thead><tbody>';
    for (const d of allDonors) {
      html += '<tr><td><strong>' + esc(d.name) + '</strong></td>' +
        '<td style="color:var(--muted)">' + esc(d.email || '—') + '</td>' +
        '<td style="color:var(--muted)">' + esc(d.phone || '—') + '</td>' +
        '<td style="color:var(--muted)">' + esc([d.city, d.state].filter(Boolean).join(', ') || '—') + '</td>' +
        "<td><button class='btn btn-sm btn-outline' onclick=\\"editDonor('" + d.id + "')\\">Edit</button> " +
        "<button class='btn btn-sm btn-danger' onclick=\\"deleteDonor('" + d.id + "')\\">Del</button></td></tr>";
    }
    html += '</tbody></table>';
    document.getElementById('donorsTable').innerHTML = html;
    populateDonorDropdown();
  } catch(e) {
    document.getElementById('donorsTable').innerHTML = '<div class="empty">Failed to load donors</div>';
  }
}

function openDonorForm(donor) {
  document.getElementById('donorModalTitle').textContent = donor ? 'Edit Donor' : 'Add Donor';
  document.getElementById('donorEditId').value = donor ? donor.id : '';
  document.getElementById('donorName').value = donor ? donor.name : '';
  document.getElementById('donorEmail').value = donor ? (donor.email || '') : '';
  document.getElementById('donorPhone').value = donor ? (donor.phone || '') : '';
  document.getElementById('donorAddress').value = donor ? (donor.address || '') : '';
  document.getElementById('donorCity').value = donor ? (donor.city || '') : '';
  document.getElementById('donorState').value = donor ? (donor.state || '') : '';
  document.getElementById('donorZip').value = donor ? (donor.zip || '') : '';
  document.getElementById('donorModal').classList.add('open');
}

function editDonor(id) { const d = allDonors.find(x => x.id === id); if (d) openDonorForm(d); }

async function saveDonor() {
  const id = document.getElementById('donorEditId').value;
  const body = {
    name: document.getElementById('donorName').value,
    email: document.getElementById('donorEmail').value || null,
    phone: document.getElementById('donorPhone').value || null,
    address: document.getElementById('donorAddress').value || null,
    city: document.getElementById('donorCity').value || null,
    state: document.getElementById('donorState').value || null,
    zip: document.getElementById('donorZip').value || null,
  };
  if (!body.name) { showToast('Name is required', 'error'); return; }
  try {
    if (id) {
      await fetch(API + '/donors/' + id, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
    } else {
      body.tenant_id = TENANT;
      await fetch(API + '/donors', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
    }
    closeModal('donorModal');
    showToast('Donor saved', 'success');
    loadDonors();
  } catch(e) { showToast('Failed to save donor', 'error'); }
}

async function deleteDonor(id) {
  if (!confirm('Delete this donor?')) return;
  await fetch(API + '/donors/' + id, { method: 'DELETE' });
  showToast('Donor deleted', 'success');
  loadDonors();
}

// ═══ DONATIONS ═══
async function loadDonations() {
  try {
    let url = API + '/donations?tenant_id=' + TENANT;
    const from = document.getElementById('filterFrom').value;
    const to = document.getElementById('filterTo').value;
    const fund = document.getElementById('filterFund').value;
    if (from && to) url += '&from=' + from + '&to=' + to;
    if (fund) url += '&fund_id=' + fund;

    const res = await fetch(url);
    const result = await res.json();
    const donations = result.data || [];

    const total = donations.reduce((s, d) => s + d.amount, 0);
    document.getElementById('donationStats').innerHTML =
      '<div class="stat"><div class="stat-value">' + donations.length + '</div><div class="stat-label">Donations</div></div>' +
      '<div class="stat"><div class="stat-value amount">$' + total.toLocaleString(undefined, {minimumFractionDigits:2}) + '</div><div class="stat-label">Total Amount</div></div>';

    if (!donations.length) {
      document.getElementById('donationsTable').innerHTML = '<div class="empty">No donations found.</div>';
      return;
    }
    // Build donor name map
    const donorMap = {};
    allDonors.forEach(d => donorMap[d.id] = d.name);
    const fundMap = {};
    allFunds.forEach(f => fundMap[f.id] = f.name);

    let html = '<table><thead><tr><th>Date</th><th>Donor</th><th>Amount</th><th>Fund</th><th>Method</th></tr></thead><tbody>';
    for (const d of donations) {
      html += '<tr><td class="mono">' + esc(d.date) + '</td>' +
        '<td>' + esc(donorMap[d.donor_id] || d.donor_id.substring(0,8)) + '</td>' +
        '<td class="amount">$' + d.amount.toFixed(2) + '</td>' +
        '<td>' + esc(fundMap[d.fund_id] || d.fund_id || '—') + '</td>' +
        '<td style="color:var(--muted)">' + esc(d.method || '—') + '</td></tr>';
    }
    html += '</tbody></table>';
    document.getElementById('donationsTable').innerHTML = html;
  } catch(e) {
    document.getElementById('donationsTable').innerHTML = '<div class="empty">Failed to load donations</div>';
  }
}

function openDonationForm() {
  populateDonorDropdown();
  populateFundDropdown();
  document.getElementById('donationAmount').value = '';
  document.getElementById('donationDate').value = new Date().toISOString().slice(0,10);
  document.getElementById('donationCheck').value = '';
  document.getElementById('donationNotes').value = '';
  document.getElementById('donationModal').classList.add('open');
}

async function saveDonation() {
  const body = {
    tenant_id: TENANT,
    donor_id: document.getElementById('donationDonor').value,
    amount: parseFloat(document.getElementById('donationAmount').value),
    date: document.getElementById('donationDate').value,
    fund_id: document.getElementById('donationFund').value || null,
    method: document.getElementById('donationMethod').value || null,
    check_number: document.getElementById('donationCheck').value || null,
    notes: document.getElementById('donationNotes').value || null,
  };
  if (!body.donor_id || !body.amount || !body.date) { showToast('Donor, amount, and date are required', 'error'); return; }
  try {
    await fetch(API + '/donations', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
    closeModal('donationModal');
    showToast('Donation recorded', 'success');
    loadDonations();
  } catch(e) { showToast('Failed to save donation', 'error'); }
}

// ═══ FUNDS ═══
async function loadFunds() {
  try {
    const res = await fetch(API + '/funds?tenant_id=' + TENANT);
    const result = await res.json();
    allFunds = result.data || [];

    if (!allFunds.length) {
      document.getElementById('fundsTable').innerHTML = '<div class="empty">No funds yet. Add one or import a CSV.</div>';
      return;
    }
    let html = '<table><thead><tr><th>Name</th><th>Description</th><th></th></tr></thead><tbody>';
    for (const f of allFunds) {
      html += '<tr><td><strong>' + esc(f.name) + '</strong></td>' +
        '<td style="color:var(--muted)">' + esc(f.description || '—') + '</td>' +
        "<td><button class='btn btn-sm btn-outline' onclick=\\"editFund('" + f.id + "')\\">Edit</button> " +
        "<button class='btn btn-sm btn-danger' onclick=\\"deleteFund('" + f.id + "')\\">Del</button></td></tr>";
    }
    html += '</tbody></table>';
    document.getElementById('fundsTable').innerHTML = html;
    populateFundFilter();
  } catch(e) {
    document.getElementById('fundsTable').innerHTML = '<div class="empty">Failed to load funds</div>';
  }
}

function openFundForm(fund) {
  document.getElementById('fundModalTitle').textContent = fund ? 'Edit Fund' : 'Add Fund';
  document.getElementById('fundEditId').value = fund ? fund.id : '';
  document.getElementById('fundName').value = fund ? fund.name : '';
  document.getElementById('fundDesc').value = fund ? (fund.description || '') : '';
  document.getElementById('fundModal').classList.add('open');
}

function editFund(id) { const f = allFunds.find(x => x.id === id); if (f) openFundForm(f); }

async function saveFund() {
  const id = document.getElementById('fundEditId').value;
  const body = { name: document.getElementById('fundName').value, description: document.getElementById('fundDesc').value || null };
  if (!body.name) { showToast('Name is required', 'error'); return; }
  try {
    if (id) {
      await fetch(API + '/funds/' + id, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
    } else {
      body.tenant_id = TENANT;
      await fetch(API + '/funds', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
    }
    closeModal('fundModal');
    showToast('Fund saved', 'success');
    loadFunds();
  } catch(e) { showToast('Failed to save fund', 'error'); }
}

async function deleteFund(id) {
  if (!confirm('Delete this fund?')) return;
  await fetch(API + '/funds/' + id, { method: 'DELETE' });
  showToast('Fund deleted', 'success');
  loadFunds();
}

// ═══ HELPERS ═══
function populateDonorDropdown() {
  const sel = document.getElementById('donationDonor');
  sel.innerHTML = '<option value="">Select donor...</option>';
  allDonors.forEach(d => { sel.innerHTML += '<option value="' + d.id + '">' + esc(d.name) + '</option>'; });
}

function populateFundDropdown() {
  const sel = document.getElementById('donationFund');
  sel.innerHTML = '<option value="">None</option>';
  allFunds.forEach(f => { sel.innerHTML += '<option value="' + f.id + '">' + esc(f.name) + '</option>'; });
}

function populateFundFilter() {
  const sel = document.getElementById('filterFund');
  sel.innerHTML = '<option value="">All Funds</option>';
  allFunds.forEach(f => { sel.innerHTML += '<option value="' + f.id + '">' + esc(f.name) + '</option>'; });
}

function closeModal(id) { document.getElementById(id).classList.remove('open'); }
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

// Init
loadJobs();
// Pre-load donors and funds for dropdowns
fetch(API + '/donors?tenant_id=' + TENANT).then(r => r.json()).then(r => { allDonors = r.data || []; });
fetch(API + '/funds?tenant_id=' + TENANT).then(r => r.json()).then(r => { allFunds = r.data || []; });
</script>
</body>
</html>`;
