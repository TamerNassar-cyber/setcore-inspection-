/**
 * Generates a self-contained HTML string for a Setcore inspection report.
 * Used by expo-print to produce a PDF on native or trigger browser print on web.
 */

interface ReportRun {
  id: string;
  inspector_name: string;
  start_time: string;
  total_joints: number;
  accepted: number;
  failed: number;
  rejected: number;
  total_length_ft: number;
  defects: ReportDefect[];
}

interface ReportDefect {
  id: string;
  defect_type: string;
  location?: string;
  severity: string;
  description?: string;
}

interface ReportJob {
  id: string;
  job_number: string;
  client: string;
  rig: string;
  well: string;
  field?: string;
  country: string;
  standard: string;
  status: string;
  created_at: string;
  creator_name: string;
  runs: ReportRun[];
}

function formatDefectType(code: string): string {
  const map: Record<string, string> = {
    DRIFT: 'Drift / ID Restriction',
    THREAD_DAMAGE: 'Thread Damage',
    CORROSION: 'Corrosion',
    BODY_DEFECT: 'Body Defect',
    COUPLING_DEFECT: 'Coupling Defect',
    PITTING: 'Pitting',
    WASH: 'Wash / Erosion',
    SLIP_CUT: 'Slip Cut',
    MECHANICAL_DAMAGE: 'Mechanical Damage',
    DIMENSIONAL: 'Dimensional Non-conformance',
    COATING: 'Coating Defect',
    OTHER: 'Other',
  };
  return map[code] ?? code;
}

function formatLocation(code: string): string {
  const map: Record<string, string> = { box_end: 'Box End', body: 'Body', pin_end: 'Pin End' };
  return map[code] ?? code;
}

function severityColor(sev: string): string {
  if (sev === 'critical') return '#DC2626';
  if (sev === 'major') return '#FF4715';
  return '#F59E0B';
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch { return iso; }
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

export function buildReportHtml(job: ReportJob): string {
  const grandTotal = job.runs.reduce((acc, r) => ({
    total_joints: acc.total_joints + r.total_joints,
    accepted: acc.accepted + r.accepted,
    failed: acc.failed + r.failed,
    rejected: acc.rejected + r.rejected,
    total_length_ft: acc.total_length_ft + r.total_length_ft,
  }), { total_joints: 0, accepted: 0, failed: 0, rejected: 0, total_length_ft: 0 });

  const passRate = grandTotal.total_joints > 0
    ? Math.round((grandTotal.accepted / grandTotal.total_joints) * 100)
    : 0;

  const allDefects = job.runs.flatMap(r =>
    r.defects.map(d => ({ ...d, inspector: r.inspector_name }))
  );

  const defectRows = allDefects.map(d => `
    <tr>
      <td>${formatDefectType(d.defect_type)}</td>
      <td>${d.location ? formatLocation(d.location) : '—'}</td>
      <td style="color:${severityColor(d.severity)};font-weight:700">${d.severity.toUpperCase()}</td>
      <td>${d.description ?? '—'}</td>
      <td>${d.inspector}</td>
    </tr>`).join('');

  const runRows = job.runs.map((r, idx) => `
    <tr>
      <td>Run ${idx + 1}</td>
      <td>${r.inspector_name}</td>
      <td>${formatDateTime(r.start_time)}</td>
      <td>${r.total_joints}</td>
      <td style="color:#22C55E">${r.accepted}</td>
      <td style="color:#FF4715">${r.failed}</td>
      <td style="color:#DC2626">${r.rejected}</td>
      <td>${Math.round(r.total_length_ft)} ft</td>
      <td>${r.defects.length}</td>
    </tr>`).join('');

  const fieldRow = job.field ? `<tr><td>Field</td><td>${job.field}</td></tr>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Setcore Inspection Report — ${job.job_number}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, Arial, sans-serif; font-size: 12px; color: #1a1a1a; background: #fff; padding: 32px; }
  h1 { font-size: 22px; font-weight: 800; color: #FF4715; letter-spacing: 1px; }
  h2 { font-size: 13px; font-weight: 700; color: #555; letter-spacing: 2px; text-transform: uppercase; margin: 28px 0 10px; border-bottom: 1px solid #e5e5e5; padding-bottom: 6px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #FF4715; padding-bottom: 20px; margin-bottom: 24px; }
  .brand-name { font-size: 18px; font-weight: 900; color: #1a1a1a; letter-spacing: 2px; }
  .brand-sub { font-size: 10px; color: #888; letter-spacing: 3px; margin-top: 3px; }
  .report-title { text-align: right; }
  .report-title h1 { font-size: 16px; }
  .report-title .job-num { font-size: 22px; font-weight: 900; color: #1a1a1a; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  table th { background: #f5f5f5; font-weight: 700; text-align: left; padding: 8px 10px; font-size: 10px; letter-spacing: 0.5px; color: #555; border-bottom: 1px solid #e5e5e5; }
  table td { padding: 8px 10px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
  .info-table td:first-child { font-weight: 600; color: #888; width: 40%; font-size: 11px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 8px; }
  .kpi { background: #f9f9f9; border-radius: 8px; padding: 12px; text-align: center; border: 1px solid #ebebeb; }
  .kpi-value { font-size: 26px; font-weight: 900; }
  .kpi-label { font-size: 9px; color: #888; font-weight: 700; letter-spacing: 1px; margin-top: 3px; }
  .pass-rate-box { background: #f0fdf4; border: 2px solid #22C55E; border-radius: 8px; padding: 16px 20px; display: inline-flex; align-items: center; gap: 16px; margin-bottom: 16px; }
  .pass-rate-value { font-size: 40px; font-weight: 900; color: #22C55E; }
  .pass-rate-label { font-size: 11px; font-weight: 700; color: #888; letter-spacing: 1px; }
  .status-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; letter-spacing: 0.5px; }
  .status-active { background: #dcfce7; color: #16a34a; }
  .status-completed { background: #dbeafe; color: #1d4ed8; }
  .status-approved { background: #fff7ed; color: #c2410c; }
  .footer { margin-top: 40px; border-top: 1px solid #e5e5e5; padding-top: 16px; text-align: center; color: #aaa; font-size: 10px; }
  .footer strong { color: #555; }
  @media print {
    body { padding: 20px; }
    .page-break { page-break-before: always; }
  }
</style>
</head>
<body>

<div class="header">
  <div>
    <div class="brand-name">SETCORE</div>
    <div class="brand-sub">PETROLEUM SERVICES</div>
  </div>
  <div class="report-title">
    <h1>FIELD INSPECTION REPORT</h1>
    <div class="job-num">${job.job_number}</div>
    <div style="color:#888;font-size:11px;margin-top:4px">${formatDate(job.created_at)}</div>
  </div>
</div>

<h2>Job Details</h2>
<table class="info-table">
  <tr><td>Client</td><td>${job.client}</td></tr>
  <tr><td>Rig</td><td>${job.rig}</td></tr>
  <tr><td>Well</td><td>${job.well}</td></tr>
  ${fieldRow}
  <tr><td>Country</td><td>${job.country}</td></tr>
  <tr><td>Standard</td><td><strong>${job.standard.replace(/_/g, ' ')}</strong></td></tr>
  <tr><td>Inspector</td><td>${job.creator_name}</td></tr>
  <tr><td>Status</td><td>
    <span class="status-badge status-${job.status}">${job.status.toUpperCase()}</span>
  </td></tr>
</table>

<h2>Inspection Summary</h2>
<div class="pass-rate-box">
  <div>
    <div class="pass-rate-value">${passRate}%</div>
    <div class="pass-rate-label">PASS RATE</div>
  </div>
  <div style="width:1px;height:50px;background:#e5e5e5"></div>
  <div>
    <div style="font-size:11px;color:#888;margin-bottom:6px">${job.runs.length} inspection run${job.runs.length !== 1 ? 's' : ''}</div>
    <div style="font-size:11px;color:#888">${Math.round(grandTotal.total_length_ft)} ft total footage</div>
  </div>
</div>
<div class="kpi-grid">
  <div class="kpi"><div class="kpi-value">${grandTotal.total_joints}</div><div class="kpi-label">TOTAL</div></div>
  <div class="kpi"><div class="kpi-value" style="color:#22C55E">${grandTotal.accepted}</div><div class="kpi-label">PASS</div></div>
  <div class="kpi"><div class="kpi-value" style="color:#FF4715">${grandTotal.failed}</div><div class="kpi-label">FAIL</div></div>
  <div class="kpi"><div class="kpi-value" style="color:#DC2626">${grandTotal.rejected}</div><div class="kpi-label">REJECT</div></div>
  <div class="kpi"><div class="kpi-value" style="color:#3b82f6">${Math.round(grandTotal.total_length_ft)}'</div><div class="kpi-label">FOOTAGE</div></div>
</div>

<h2>Run Breakdown</h2>
<table>
  <thead>
    <tr>
      <th>Run</th><th>Inspector</th><th>Date</th><th>Joints</th>
      <th>Pass</th><th>Fail</th><th>Reject</th><th>Footage</th><th>Defects</th>
    </tr>
  </thead>
  <tbody>${runRows}</tbody>
</table>

${allDefects.length > 0 ? `
<h2>Defects Logged (${allDefects.length})</h2>
<table>
  <thead>
    <tr>
      <th>Type</th><th>Location</th><th>Severity</th><th>Description</th><th>Inspector</th>
    </tr>
  </thead>
  <tbody>${defectRows}</tbody>
</table>` : ''}

<div class="footer">
  <strong>Setcore Petroleum Services</strong><br />
  Generated ${formatDateTime(new Date().toISOString())} &nbsp;·&nbsp; ${job.job_number}
</div>

</body>
</html>`;
}
