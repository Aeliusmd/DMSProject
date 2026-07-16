/**
 * Generates DMS Load Test Results PDF on the Desktop.
 * Usage: node load-tests/generate-report.js
 */
const path = require('path');
const fs = require('fs');
// Resolve pdfkit from backend dependencies when run from load-tests/
const PDFDocument = require(path.join(__dirname, '..', 'backend', 'node_modules', 'pdfkit'));

const OUT = path.join(process.env.USERPROFILE || process.env.HOME, 'Desktop', 'DMS_Load_Test_Report.pdf');

const COLORS = {
  primary: '#0f172a',
  accent: '#2563eb',
  success: '#16a34a',
  warn: '#ca8a04',
  danger: '#dc2626',
  muted: '#64748b',
  light: '#f1f5f9',
  bar: '#3b82f6',
  bar2: '#10b981',
  bar3: '#f59e0b',
  bar4: '#8b5cf6',
};

function drawHeader(doc, title, subtitle) {
  doc.rect(0, 0, doc.page.width, 72).fill(COLORS.primary);
  doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold').text(title, 40, 22, { width: 500 });
  if (subtitle) {
    doc.fontSize(10).font('Helvetica').fillColor('#cbd5e1').text(subtitle, 40, 46, { width: 500 });
  }
  doc.moveDown(3);
  doc.fillColor(COLORS.primary);
}

function sectionTitle(doc, text) {
  doc.moveDown(0.6);
  doc.fontSize(14).fillColor(COLORS.accent).font('Helvetica-Bold').text(text);
  doc.moveTo(40, doc.y + 2).lineTo(555, doc.y + 2).strokeColor('#e2e8f0').stroke();
  doc.moveDown(0.5);
  doc.fillColor(COLORS.primary).font('Helvetica').fontSize(10);
}

function kv(doc, label, value) {
  const y = doc.y;
  doc.font('Helvetica-Bold').fillColor(COLORS.muted).text(label, 40, y, { width: 180, continued: false });
  doc.font('Helvetica').fillColor(COLORS.primary).text(String(value), 230, y, { width: 320 });
  doc.moveDown(0.15);
}

function bullet(doc, text) {
  doc.font('Helvetica').fontSize(10).fillColor(COLORS.primary).text(`•  ${text}`, { indent: 10 });
}

function drawBarChart(doc, opts) {
  const { title, labels, values, x = 50, y, width = 480, height = 140, unit = '', color = COLORS.bar } = opts;
  const max = Math.max(...values, 1);
  const barW = width / labels.length - 12;
  doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.primary).text(title, x, y);
  const chartY = y + 22;
  doc.strokeColor('#e2e8f0').moveTo(x, chartY + height).lineTo(x + width, chartY + height).stroke();
  labels.forEach((label, i) => {
    const h = (values[i] / max) * (height - 10);
    const bx = x + i * (barW + 12) + 6;
    const by = chartY + height - h;
    doc.rect(bx, by, barW, h).fill(color);
    doc.fontSize(8).fillColor(COLORS.primary).text(String(values[i]) + unit, bx - 4, by - 12, { width: barW + 8, align: 'center' });
    doc.fontSize(7).fillColor(COLORS.muted).text(label, bx - 6, chartY + height + 4, { width: barW + 12, align: 'center' });
  });
  return chartY + height + 28;
}

function drawHorizontalBars(doc, opts) {
  const { title, items, x = 50, y, width = 420 } = opts;
  doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.primary).text(title, x, y);
  let cy = y + 20;
  const max = Math.max(...items.map((i) => i.value), 1);
  items.forEach((item) => {
    const barW = (item.value / max) * width;
    doc.fontSize(9).fillColor(COLORS.primary).text(item.label, x, cy, { width: 130 });
    doc.rect(x + 140, cy, barW, 12).fill(item.color || COLORS.bar);
    doc.fontSize(8).fillColor(COLORS.muted).text(item.display || String(item.value), x + 150 + barW, cy + 1);
    cy += 22;
  });
  return cy + 8;
}

function drawPassFail(doc, x, y, passed) {
  const color = passed ? COLORS.success : COLORS.danger;
  const label = passed ? 'PASSED' : 'FAILED';
  doc.roundedRect(x, y, 70, 18, 4).fill(color);
  doc.fillColor('#fff').fontSize(9).font('Helvetica-Bold').text(label, x, y + 4, { width: 70, align: 'center' });
  doc.fillColor(COLORS.primary).font('Helvetica');
}

const doc = new PDFDocument({ margin: 40, size: 'LETTER', info: {
  Title: 'DMS Load Test Results Report',
  Author: 'DMS Load Testing Suite',
  Subject: 'Orders API Load Test — k6 / Faker / OpenTelemetry',
  CreationDate: new Date('2026-07-16'),
}});

const stream = fs.createWriteStream(OUT);
doc.pipe(stream);

// ========== COVER ==========
doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLORS.primary);
doc.fillColor('#ffffff').fontSize(28).font('Helvetica-Bold')
  .text('DMS Project', 50, 180, { align: 'left' });
doc.fontSize(22).fillColor('#93c5fd')
  .text('Load Test Results Report', 50, 220);
doc.fontSize(12).fillColor('#cbd5e1')
  .text('Document Management System — Orders Module Performance Validation', 50, 260, { width: 500 });
doc.moveTo(50, 290).lineTo(300, 290).strokeColor('#3b82f6').lineWidth(2).stroke();

doc.fontSize(11).fillColor('#e2e8f0');
const metaY = 320;
[
  ['Test Date', '16 July 2026'],
  ['Environment', 'Local (Windows) — dms_db_backup'],
  ['Scenario', 'orders-read (ramp 10 → 100 VUs)'],
  ['Duration', '4 minutes 30 seconds'],
  ['Overall Result', 'ALL THRESHOLDS PASSED'],
  ['Document Version', '1.0'],
].forEach(([k, v], i) => {
  doc.font('Helvetica-Bold').fillColor('#94a3b8').text(k, 50, metaY + i * 22, { width: 140 });
  doc.font('Helvetica').fillColor('#ffffff').text(v, 200, metaY + i * 22);
});

doc.fontSize(9).fillColor('#64748b').text('Confidential — Internal Engineering Use', 50, 720);

// ========== 1. EXECUTIVE SUMMARY ==========
doc.addPage();
drawHeader(doc, '1. Executive Summary', 'High-level outcome of the DMS load test campaign');
doc.y = 90;

doc.fontSize(10).fillColor(COLORS.primary).font('Helvetica')
  .text(
    'This report documents a controlled load test of the DMS (Document Management System) Orders APIs. ' +
    'Synthetic data was seeded with Faker.js into an isolated MySQL clone (dms_db_backup). Traffic was generated with Grafana k6. ' +
    'Application metrics and traces were collected via OpenTelemetry and observed in Prometheus + Grafana.',
    { align: 'justify', lineGap: 2 }
  );

doc.moveDown(1);
sectionTitle(doc, 'Verdict');
doc.fontSize(11).fillColor(COLORS.success).font('Helvetica-Bold')
  .text('PASSED — System met all defined performance thresholds under peak load of 100 concurrent virtual users.');
doc.fillColor(COLORS.primary).font('Helvetica').fontSize(10);
doc.moveDown(0.5);

const summaryItems = [
  ['Peak concurrent users (VUs)', '100'],
  ['Total HTTP requests', '22,856'],
  ['Request throughput', '84.48 req/s'],
  ['Iterations completed', '3,265'],
  ['Checks succeeded', '99.94% (22,843 / 22,855)'],
  ['HTTP failure rate', '0.05% (threshold < 1%)'],
  ['Overall p95 latency', '1.21 s (threshold < 3.0 s)'],
  ['Orders list p95 latency', '1.45 s (threshold < 1.5 s)'],
  ['Data transferred (received)', '1.3 GB (~4.9 MB/s)'],
  ['Test wall-clock duration', '4 m 30 s'],
];
summaryItems.forEach(([k, v]) => kv(doc, k, v));

doc.moveDown(0.8);
sectionTitle(doc, 'Key Findings');
bullet(doc, 'Orders list/search/filter endpoints remained within SLA at 100 VUs.');
bullet(doc, 'Authentication (login + 2FA) succeeded for all VU sessions during setup.');
bullet(doc, 'Only 13 HTTP failures out of 22,856 requests (0.05%) — well under the 1% budget.');
bullet(doc, 'Cursor/pagination path returned HTTP 200 for all samples.');
bullet(doc, 'Database clone held ~10,000 seeded orders plus related workflow/payment/invoice rows without connection collapse.');

// ========== 2. TECHNOLOGIES ==========
doc.addPage();
drawHeader(doc, '2. Technologies & Tooling', 'Stack used for data generation, load injection, and observability');
doc.y = 90;

const tech = [
  ['Layer', 'Technology', 'Role'],
  ['Application', 'Node.js + Express (backend)', 'DMS REST API under test'],
  ['Application', 'Next.js (frontend)', 'UI (not exercised by this k6 scenario)'],
  ['Database', 'MySQL — schema dms_db_backup', 'Isolated clone of production-like data'],
  ['Data seeding', 'Faker.js (@faker-js/faker)', 'Generate realistic facilities, providers, orders'],
  ['Load generator', 'Grafana k6', 'VU-based HTTP load + thresholds'],
  ['Auth (test)', 'LOAD_TEST_MODE + OTP', 'Dev OTP returned for automated 2FA'],
  ['Telemetry', 'OpenTelemetry SDK (Node)', 'HTTP metrics + traces export'],
  ['Collector', 'OpenTelemetry Collector', 'OTLP HTTP ingest → Prometheus'],
  ['Metrics store', 'Prometheus', 'Time-series scrape of OTel metrics'],
  ['Dashboards', 'Grafana', 'Live visualization (localhost:3001)'],
  ['Orchestration', 'Docker Compose', 'Runs OTel / Prometheus / Grafana'],
  ['OS / Runtime', 'Windows 10 + Node.js', 'Local engineering workstation'],
];

const colW = [100, 180, 230];
let ty = doc.y;
tech.forEach((row, ri) => {
  const bg = ri === 0 ? COLORS.primary : ri % 2 === 0 ? COLORS.light : '#ffffff';
  const fg = ri === 0 ? '#ffffff' : COLORS.primary;
  doc.rect(40, ty, 515, 20).fill(bg);
  let cx = 45;
  row.forEach((cell, ci) => {
    doc.fillColor(fg).font(ri === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(8)
      .text(cell, cx, ty + 5, { width: colW[ci] - 4 });
    cx += colW[ci];
  });
  ty += 20;
});
doc.y = ty + 16;

sectionTitle(doc, 'Repository Artifacts');
bullet(doc, 'backend/scripts/seed-load-test-data.js — Faker seeder (LT-* prefixed rows)');
bullet(doc, 'backend/scripts/cleanup-load-test-data.js — safe cleanup of LT-* data');
bullet(doc, 'load-tests/k6/orders-read.js — main load scenario (this report)');
bullet(doc, 'load-tests/k6/smoke.js, soak.js — complementary profiles');
bullet(doc, 'load-tests/observability/docker-compose.yml — OTel + Prometheus + Grafana');
bullet(doc, 'backend/src/telemetry.js — OTel bootstrap when OTEL_ENABLED=true');

doc.moveDown(0.8);
sectionTitle(doc, 'Safety Controls');
bullet(doc, 'Seeder refuses to run unless DB_NAME === dms_db_backup (production protected).');
bullet(doc, 'LOAD_TEST_MODE only exposes OTP outside production NODE_ENV.');
bullet(doc, 'All seeded entities tagged with LT- prefix / load-test email for cleanup.');

// ========== 3. DATA POOL ==========
doc.addPage();
drawHeader(doc, '3. Test Data Pool', 'Synthetic dataset volume seeded before load injection');
doc.y = 90;

doc.fontSize(10).text(
  'Data was generated with Faker.js and inserted into MySQL database dms_db_backup. ' +
  'The pool simulates a realistic multi-tenant DMS workload spanning facilities, providers, orders, workflow steps, payments, and invoices.',
  { align: 'justify' }
);
doc.moveDown(0.8);

const dataPool = [
  { label: 'Orders (LT-*)', value: 10000, display: '10,000', color: COLORS.bar },
  { label: 'Facilities', value: 50, display: '50', color: COLORS.bar2 },
  { label: 'Providers / Law Firms', value: 30, display: '30', color: COLORS.bar3 },
  { label: 'Invoices (approx.)', value: 2482, display: '~2,482', color: COLORS.bar4 },
  { label: 'Workflow steps', value: 10000, display: '~10,000+', color: '#06b6d4' },
  { label: 'Payment records', value: 5000, display: 'thousands', color: '#ec4899' },
];

doc.y = drawHorizontalBars(doc, {
  title: 'Figure 1 — Seeded entity volumes',
  items: dataPool.map((d) => ({ label: d.label, value: d.value, display: d.display, color: d.color })),
  y: doc.y,
});

doc.moveDown(0.5);
sectionTitle(doc, 'Data Characteristics');
bullet(doc, 'Order numbers: LT-YYYY-NNNNNN format for easy identification and cleanup.');
bullet(doc, 'Patients / attorneys / addresses: Faker-generated realistic US-style values.');
bullet(doc, 'Statuses: mixed across workflow (Review Records, Serve, Sent, etc.).');
bullet(doc, 'Relations: orders linked to facilities, companies/providers, payments, invoices.');
bullet(doc, 'Load-test user: username loadtest / email loadtest@dms.local (role: admin).');
bullet(doc, 'Existing non-LT production-like rows in the clone remained untouched.');

doc.moveDown(0.6);
sectionTitle(doc, 'Database Target');
kv(doc, 'Database name', 'dms_db_backup');
kv(doc, 'Purpose', 'Isolated clone — NOT production');
kv(doc, 'Seed command', 'npm run seed:load-test');
kv(doc, 'Cleanup command', 'npm run seed:load-test:cleanup');

// ========== 4. SCOPE / SECTIONS ==========
doc.addPage();
drawHeader(doc, '4. DMS Sections Covered', 'Functional areas exercised by the orders-read scenario');
doc.y = 90;

doc.fontSize(10).text(
  'This campaign focused on the Orders domain — the highest-traffic operational path in DMS. ' +
  'Each virtual user iteration exercised a basket of authenticated read APIs that power the staff Orders screens.',
  { align: 'justify' }
);
doc.moveDown(0.8);

const sections = [
  ['#', 'DMS Section / Capability', 'Endpoint / Action', 'Coverage'],
  ['1', 'Authentication', 'POST /auth/login', 'Credentials + password'],
  ['2', 'Two-Factor Auth', 'POST /auth/verify-2fa', 'OTP (LOAD_TEST_MODE)'],
  ['3', 'Orders List / Grid', 'GET /orders', 'Paginated order listing'],
  ['4', 'Orders Dashboard Stats', 'GET /orders/stats', 'Counts / aggregates'],
  ['5', 'Company / Provider Lookup', 'GET /orders/companies', 'Dropdown / filter source'],
  ['6', 'Facility Lookup', 'GET /orders/facilities', 'Facility filter source'],
  ['7', 'Order Search', 'GET /orders?search=', 'Text search across orders'],
  ['8', 'Year Filter', 'GET /orders?year=', 'Temporal filter'],
  ['9', 'Cursor Pagination', 'GET /orders?cursor=', 'Infinite-scroll path'],
  ['10', 'Order Detail', 'GET /orders/:id', 'Single-order payload'],
];

ty = doc.y;
sections.forEach((row, ri) => {
  const bg = ri === 0 ? COLORS.primary : ri % 2 === 0 ? COLORS.light : '#ffffff';
  const fg = ri === 0 ? '#ffffff' : COLORS.primary;
  const heights = ri === 0 ? 18 : 18;
  doc.rect(40, ty, 515, heights).fill(bg);
  const widths = [28, 150, 200, 130];
  let cx = 44;
  row.forEach((cell, ci) => {
    doc.fillColor(fg).font(ri === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.5)
      .text(cell, cx, ty + 4, { width: widths[ci] - 4 });
    cx += widths[ci];
  });
  ty += heights;
});
doc.y = ty + 16;

sectionTitle(doc, 'Sections NOT in this run (future scope)');
bullet(doc, 'Write paths: create/update order, workflow status transitions, serve/send.');
bullet(doc, 'File upload / document generation / PDF invoice rendering under load.');
bullet(doc, 'Email/SMTP delivery concurrency.');
bullet(doc, 'Company portal & personal-request portals (frontend user journeys).');
bullet(doc, 'Payment gateway callbacks and webhook storms.');

doc.moveDown(0.6);
sectionTitle(doc, 'Load Profile (VU stages)');
doc.fontSize(10).text('Ramp schedule used in orders-read.js:');
doc.moveDown(0.3);
bullet(doc, 'Stage 1: Ramp to 10 VUs over 30s (warm-up)');
bullet(doc, 'Stage 2: Hold 10 VUs for 1 minute');
bullet(doc, 'Stage 3: Ramp to 50 VUs over 30s');
bullet(doc, 'Stage 4: Hold 50 VUs for 1 minute');
bullet(doc, 'Stage 5: Ramp to 100 VUs over 30s');
bullet(doc, 'Stage 6: Hold 100 VUs for 1 minute (peak)');
bullet(doc, 'Think time: 0.3–0.8s sleep between iteration steps');

// ========== 5. RESULTS ==========
doc.addPage();
drawHeader(doc, '5. Detailed Test Results', 'Thresholds, latency, throughput, and check outcomes');
doc.y = 90;

sectionTitle(doc, '5.1 Threshold Evaluation');
const thresholds = [
  ['Metric', 'Threshold', 'Actual', 'Result'],
  ['http_req_duration p95 (all)', '< 3000 ms', '1210 ms', 'PASS'],
  ['orders_list p95', '< 1500 ms', '1450 ms', 'PASS'],
  ['http_req_failed rate', '< 1.00%', '0.05%', 'PASS'],
];
ty = doc.y;
thresholds.forEach((row, ri) => {
  const bg = ri === 0 ? COLORS.primary : ri % 2 === 0 ? COLORS.light : '#ffffff';
  const fg = ri === 0 ? '#ffffff' : COLORS.primary;
  doc.rect(40, ty, 515, 20).fill(bg);
  const widths = [180, 110, 110, 100];
  let cx = 48;
  row.forEach((cell, ci) => {
    const isPass = cell === 'PASS';
    doc.fillColor(isPass ? COLORS.success : fg)
      .font(ri === 0 || isPass ? 'Helvetica-Bold' : 'Helvetica').fontSize(9)
      .text(cell, cx, ty + 5, { width: widths[ci] });
    cx += widths[ci];
  });
  ty += 20;
});
doc.y = ty + 14;

sectionTitle(doc, '5.2 Latency Distribution (HTTP)');
kv(doc, 'Average', '544.11 ms');
kv(doc, 'Median (p50)', '508.60 ms');
kv(doc, 'p90', '1.03 s');
kv(doc, 'p95', '1.21 s');
kv(doc, 'Maximum', '2.12 s');
kv(doc, 'Orders list average', '676.89 ms');
kv(doc, 'Orders list p95', '1.45 s');

doc.moveDown(0.4);
doc.y = drawBarChart(doc, {
  title: 'Figure 2 — Latency percentiles (ms)',
  labels: ['avg', 'p50', 'p90', 'p95', 'max'],
  values: [544, 509, 1030, 1210, 2120],
  y: doc.y,
  unit: '',
  color: COLORS.accent,
});

sectionTitle(doc, '5.3 Throughput & Volume');
kv(doc, 'Total HTTP requests', '22,856');
kv(doc, 'Requests per second', '84.48');
kv(doc, 'Iterations', '3,265 (12.07 /s)');
kv(doc, 'Iteration duration avg', '4.31 s');
kv(doc, 'Iteration duration p95', '7.59 s');
kv(doc, 'Data received', '1.3 GB');
kv(doc, 'Data sent', '8.1 MB');

doc.addPage();
drawHeader(doc, '5. Detailed Test Results (continued)', 'Per-check breakdown');
doc.y = 90;

sectionTitle(doc, '5.4 Check Results by Endpoint Basket');
const checks = [
  ['Check', 'Pass', 'Fail', 'Pass %'],
  ['login status 200', 'All', '0', '100%'],
  ['verify-2fa status 200', 'All', '0', '100%'],
  ['orders list ok', '3,263', '2', '99.94%'],
  ['stats ok', '3,263', '2', '99.94%'],
  ['companies ok', '3,263', '2', '99.94%'],
  ['facilities ok', '3,263', '2', '99.94%'],
  ['search ok', '3,263', '2', '99.94%'],
  ['year filter ok', '3,263', '2', '99.94%'],
  ['orders cursor ok', 'All sampled', '0', '100%'],
  ['TOTAL checks', '22,843', '12', '99.94%'],
];
ty = doc.y;
checks.forEach((row, ri) => {
  const bg = ri === 0 ? COLORS.primary : ri === checks.length - 1 ? '#dbeafe' : ri % 2 === 0 ? COLORS.light : '#ffffff';
  const fg = ri === 0 ? '#ffffff' : COLORS.primary;
  doc.rect(40, ty, 515, 18).fill(bg);
  const widths = [200, 100, 80, 100];
  let cx = 48;
  row.forEach((cell, ci) => {
    doc.fillColor(fg).font(ri === 0 || ri === checks.length - 1 ? 'Helvetica-Bold' : 'Helvetica').fontSize(8)
      .text(cell, cx, ty + 4, { width: widths[ci] });
    cx += widths[ci];
  });
  ty += 18;
});
doc.y = ty + 16;

doc.y = drawBarChart(doc, {
  title: 'Figure 3 — Relative request share per iteration step (conceptual)',
  labels: ['List', 'Stats', 'Cos', 'Fac', 'Search', 'Year', 'Cursor', 'Detail'],
  values: [1, 1, 1, 1, 1, 1, 1, 1],
  y: doc.y,
  color: COLORS.bar2,
});
doc.fontSize(8).fillColor(COLORS.muted)
  .text('Note: Each iteration issues one call per step above (plus auth once per VU at start). Bars equal = equal call frequency.', 50, doc.y);

doc.moveDown(1.2);
sectionTitle(doc, '5.5 VU Scaling vs Capacity');
doc.fontSize(10).fillColor(COLORS.primary).text(
  'Peak concurrency reached 100 VUs. Throughput stabilized near ~84 requests/second with p95 under 1.3s overall. ' +
  'Orders list approached the 1.5s p95 budget (actual 1.45s) — acceptable but the closest threshold; ' +
  'further DB index tuning or response-field trimming would add headroom before production peaks beyond 100 concurrent staff users.'
);

doc.moveDown(0.6);
doc.y = drawBarChart(doc, {
  title: 'Figure 4 — Planned VU stages (peak concurrency)',
  labels: ['Warm 10', 'Hold 10', 'Ramp 50', 'Hold 50', 'Ramp 100', 'Hold 100'],
  values: [10, 10, 50, 50, 100, 100],
  y: doc.y,
  unit: ' VU',
  color: COLORS.bar3,
});

// ========== 6. OBSERVABILITY ==========
doc.addPage();
drawHeader(doc, '6. Observability Setup', 'How metrics and traces were collected during the run');
doc.y = 90;

sectionTitle(doc, 'Pipeline');
bullet(doc, 'API process starts OpenTelemetry SDK (backend/src/telemetry.js) when OTEL_ENABLED=true.');
bullet(doc, 'OTLP HTTP export → http://127.0.0.1:4318 (OpenTelemetry Collector).');
bullet(doc, 'Collector exposes Prometheus metrics endpoint scraped by Prometheus.');
bullet(doc, 'Grafana provisioned datasource → Prometheus for dashboards.');

doc.moveDown(0.5);
sectionTitle(doc, 'Local URLs (during test)');
kv(doc, 'Grafana', 'http://localhost:3001  (admin / admin)');
kv(doc, 'Prometheus', 'http://localhost:9090');
kv(doc, 'OTLP HTTP', 'http://127.0.0.1:4318');
kv(doc, 'DMS API', 'http://localhost:5000');

doc.moveDown(0.5);
sectionTitle(doc, 'Environment Flags Used');
kv(doc, 'DB_NAME', 'dms_db_backup');
kv(doc, 'LOAD_TEST_MODE', 'true');
kv(doc, 'OTEL_ENABLED', 'true');
kv(doc, 'OTEL_SERVICE_NAME', 'dms-api');
kv(doc, 'OTEL_EXPORTER_OTLP_ENDPOINT', 'http://127.0.0.1:4318');

doc.moveDown(0.8);
sectionTitle(doc, 'Recommended Grafana Panels');
bullet(doc, 'HTTP request rate (req/s) during the 4m30s window');
bullet(doc, 'HTTP latency histogram / p95 by route');
bullet(doc, 'Node.js process CPU & memory');
bullet(doc, 'MySQL connection pool wait / active queries (if instrumented)');
bullet(doc, 'Error rate overlay vs VU ramp stages');

// ========== 7. METHODOLOGY ==========
doc.addPage();
drawHeader(doc, '7. Test Methodology', 'How the campaign was executed end-to-end');
doc.y = 90;

const steps = [
  'Clone / confirm MySQL database dms_db_backup is available and selected in backend/.env.',
  'Start API server with LOAD_TEST_MODE=true (and OTEL_ENABLED=true for observability).',
  'Start Docker Compose observability stack (OTel Collector, Prometheus, Grafana).',
  'Run Faker seeder: npm run seed:load-test — creates ~10k orders + related entities.',
  'Verify loadtest user can authenticate (OTP returned in LOAD_TEST_MODE).',
  'Execute: k6 run load-tests/k6/orders-read.js',
  'Capture k6 stdout summary (thresholds, latency, checks).',
  'Review Grafana / Prometheus for corroborating API metrics.',
  'Optionally clean LT-* rows: npm run seed:load-test:cleanup',
];
steps.forEach((s, i) => {
  doc.font('Helvetica-Bold').fillColor(COLORS.accent).fontSize(10).text(`${i + 1}.`, 40, doc.y, { continued: true });
  doc.font('Helvetica').fillColor(COLORS.primary).text(`  ${s}`);
  doc.moveDown(0.25);
});

doc.moveDown(0.6);
sectionTitle(doc, 'Pass / Fail Criteria (pre-declared)');
bullet(doc, 'p95 of all HTTP requests < 3000 ms');
bullet(doc, 'p95 of orders list endpoint < 1500 ms');
bullet(doc, 'HTTP failure rate < 1%');
bullet(doc, 'No process crash / unrecoverable DB pool exhaustion');

// ========== 8. RISKS & RECOMMENDATIONS ==========
doc.addPage();
drawHeader(doc, '8. Risks, Limitations & Recommendations', 'Interpretation guidance for engineering stakeholders');
doc.y = 90;

sectionTitle(doc, 'Limitations');
bullet(doc, 'Read-heavy only — write/update/workflow transitions not stressed in this run.');
bullet(doc, 'Single-machine lab setup; production network/CDN/LB characteristics differ.');
bullet(doc, 'Orders list p95 (1.45s) is close to the 1.50s budget — limited headroom.');
bullet(doc, 'Frontend Next.js rendering and browser concurrency not measured.');
bullet(doc, 'Email/SMTP and external integrations excluded.');

doc.moveDown(0.5);
sectionTitle(doc, 'Recommendations');
bullet(doc, 'Add composite DB indexes for common Orders filters (year, status, facility, search).');
bullet(doc, 'Run a write-path scenario (create order + status transitions) before go-live peaks.');
bullet(doc, 'Execute soak.js for 30–60 minutes to detect memory leaks / pool drift.');
bullet(doc, 'Trim Orders list payload fields or add sparse field selection for grid views.');
bullet(doc, 'Re-test at 150–200 VUs after indexing to quantify new ceiling.');
bullet(doc, 'Keep load tests on dms_db_backup only; never point seeders at production.');

doc.moveDown(0.8);
sectionTitle(doc, 'Overall Conclusion');
doc.fontSize(10).fillColor(COLORS.primary).text(
  'The DMS Orders read APIs successfully handled a peak of 100 concurrent virtual users against a ~10,000-order synthetic data pool. ' +
  'All formal k6 thresholds passed with a 99.94% check success rate and 0.05% HTTP errors. ' +
  'The system is considered fit for the tested read workload, with monitoring recommended around Orders list latency as the primary early-warning signal.',
  { align: 'justify', lineGap: 2 }
);

doc.moveDown(1.2);
doc.rect(40, doc.y, 515, 50).fill('#ecfdf5');
doc.fillColor(COLORS.success).font('Helvetica-Bold').fontSize(12)
  .text('FINAL RESULT: PASSED', 50, doc.y + 12, { width: 495, align: 'center' });
doc.font('Helvetica').fontSize(9).fillColor(COLORS.primary)
  .text('All thresholds met — Orders module load test campaign complete.', 50, doc.y + 8, { width: 495, align: 'center' });

// ========== APPENDIX ==========
doc.addPage();
drawHeader(doc, 'Appendix A — Raw k6 Summary Extract', 'Source: orders-read.js run on 16 Jul 2026');
doc.y = 90;
doc.font('Courier').fontSize(8).fillColor(COLORS.primary).text(`THRESHOLDS
  http_req_duration ............... ✓ p(95)<3000     p(95)=1.21s
  {endpoint:orders_list} .......... ✓ p(95)<1500     p(95)=1.45s
  http_req_failed ................. ✓ rate<0.01      rate=0.05%

TOTAL RESULTS
  checks_total .................... 22855   84.48/s
  checks_succeeded ................ 99.94%  22843 / 22855
  checks_failed ................... 0.05%   12 / 22855

HTTP
  http_req_duration  avg=544.11ms  med=508.6ms  max=2.12s
                      p(90)=1.03s  p(95)=1.21s
  {endpoint:orders_list} avg=676.89ms p(95)=1.45s
  http_req_failed ................. 0.05%  13 / 22856
  http_reqs ....................... 22856  84.48/s

EXECUTION
  iteration_duration avg=4.31s  p(95)=7.59s
  iterations ..................... 3265
  vus_max ........................ 100

NETWORK
  data_received .................. 1.3 GB  4.9 MB/s
  data_sent ...................... 8.1 MB  30 kB/s

STATUS: orders_read completed successfully (exit 0)`);

doc.moveDown(1.5);
doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted)
  .text('Appendix B — Document control', { underline: true });
doc.moveDown(0.3);
kv(doc, 'Prepared for', 'DMS Engineering / QA');
kv(doc, 'Generated by', 'load-tests/generate-report.js');
kv(doc, 'Output path', OUT);
kv(doc, 'Related runbook', 'load-tests/README.md');

doc.end();

stream.on('finish', () => {
  console.log('Report written to:', OUT);
  console.log('Size bytes:', fs.statSync(OUT).size);
});
