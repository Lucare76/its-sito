const fs = require('fs');
const os = require('os');
const path = require('path');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function call(baseUrl, path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${path} -> ${res.status} ${body.error || 'unexpected error'}`);
  }
  return body;
}

async function run() {
  const port = 4100 + Math.floor(Math.random() * 300);
  const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'its-smoke-'));
  const smokeOperatorEmail = process.env.SMOKE_TEST_OPERATOR_EMAIL || 'smoke.operator@its.local';
  const smokeOperatorPassword = process.env.SMOKE_TEST_OPERATOR_PASSWORD || 'smoke-operator-password';

  process.env.PORT = String(port);
  process.env.DATA_DIR = tempDataDir;
  process.env.DB_PATH = path.join(tempDataDir, 'db.json');
  process.env.BOOTSTRAP_OPERATOR_EMAIL = smokeOperatorEmail;
  process.env.BOOTSTRAP_OPERATOR_PASSWORD = smokeOperatorPassword;

  const baseUrl = `http://localhost:${port}`;
  const { startServer } = require('../server');
  const server = startServer(port);

  try {
    await sleep(1500);
    await call(baseUrl, '/api/health');

    const login = await call(baseUrl, '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: smokeOperatorEmail,
        password: smokeOperatorPassword,
      }),
    });

    const headers = {
      Authorization: `Bearer ${login.token}`,
      'Content-Type': 'application/json',
    };

    const created = await call(baseUrl, '/api/bookings', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Smoke Test',
        email: 'smoke@its.test',
        service: 'Smoke Transfer',
        route: 'Napoli > Ischia',
        date: '2026-03-30',
        source: 'SMOKE_TEST',
      }),
    });

    await call(baseUrl, '/api/bookings', {
      method: 'GET',
      headers: { Authorization: `Bearer ${login.token}` },
    });

    await call(baseUrl, `/api/bookings/${created.booking.id}/confirm`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        status: 'CONFIRMED',
        note: 'Confermato da smoke test automatico',
      }),
    });

    await call(baseUrl, '/api/analytics-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'form_submit',
        session_id: 'smoke-session',
        lang: 'it',
        device_type: 'desktop',
        page_path: '/contatti.html',
        page_title: 'Smoke Analytics',
        form_id: 'contact-form',
        funnel_step: 'form_submit',
        utm: {
          utm_source: 'smoke',
          utm_medium: 'test',
          utm_campaign: 'automation',
        },
      }),
    });

    await call(baseUrl, '/api/analytics-events', {
      method: 'GET',
      headers: { Authorization: `Bearer ${login.token}` },
    });

    const analytics = await call(baseUrl, '/api/analytics-events', {
      method: 'GET',
      headers: { Authorization: `Bearer ${login.token}` },
    });
    if (!analytics.items || !analytics.items.length || analytics.items[0].deviceType !== 'desktop') {
      throw new Error('analytics deviceType non registrato correttamente');
    }

    const exportJson = await fetch(`${baseUrl}/api/analytics-events/export?format=json`, {
      headers: { Authorization: `Bearer ${login.token}` },
    });
    if (!exportJson.ok) {
      throw new Error(`/api/analytics-events/export?format=json -> ${exportJson.status}`);
    }

    const insights = await call(baseUrl, '/api/insights/report?range=30d&page=all', {
      method: 'GET',
      headers: { Authorization: `Bearer ${login.token}` },
    });
    if (!insights.report || !insights.report.totals || insights.report.totals.formSubmit < 1) {
      throw new Error('report insights non restituito correttamente');
    }

    const snapshot = await call(baseUrl, '/api/analytics-snapshots', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: 'snap_smoke_1',
        exportedAt: '2026-03-19T00:00:00.000Z',
        name: 'Smoke snapshot',
        note: 'snapshot di test automatico',
        pinned: true,
        tags: ['smoke', 'ops'],
        createdBy: {
          id: 'usr_operator_1',
          name: 'Operatore ITS',
          role: 'operator',
        },
        filters: {
          range: '7d',
          page: '/contatti.html',
        },
        totals: {
          events: 1,
          cta: 0,
          formOpen: 0,
          formSubmit: 1,
          whatsapp: 0,
        },
        funnel: [],
        previousPeriodFunnel: [],
        topPages: [],
        healthScore: [],
        topUtm: [],
        topPageUtm: [],
        segmentsByLanguage: [],
        segmentsByDevice: [],
        alerts: [],
      }),
    });

    if (!snapshot.item || snapshot.item.id !== 'snap_smoke_1' || snapshot.item.name !== 'Smoke snapshot' || snapshot.item.pinned !== true) {
      throw new Error('snapshot analytics non salvato correttamente');
    }

    const snapshots = await call(baseUrl, '/api/analytics-snapshots', {
      method: 'GET',
      headers: { Authorization: `Bearer ${login.token}` },
    });
    if (!snapshots.items || !snapshots.items.some((item) => item.id === 'snap_smoke_1')) {
      throw new Error('snapshot analytics non restituito correttamente');
    }

    await call(baseUrl, '/api/analytics-snapshots/snap_smoke_1', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${login.token}` },
    });

    console.log('SMOKE_TEST_OK');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tempDataDir, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(`SMOKE_TEST_FAIL: ${error.message}`);
  process.exit(1);
});
