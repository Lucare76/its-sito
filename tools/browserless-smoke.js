const fs = require('fs');
const os = require('os');
const path = require('path');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestJson(url, options = {}) {
  const res = await fetch(url, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${url} -> ${res.status} ${body.error || 'unexpected error'}`);
  }
  return body;
}

async function requestText(url, options = {}) {
  const res = await fetch(url, options);
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`${url} -> ${res.status}`);
  }
  return body;
}

function assertContains(haystack, needle, label) {
  if (!haystack.includes(needle)) {
    throw new Error(`Contenuto mancante in ${label}: ${needle}`);
  }
}

async function run() {
  const port = 4400 + Math.floor(Math.random() * 300);
  const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'its-browserless-'));
  const smokeOperatorEmail = 'browserless.operator@its.local';
  const smokeOperatorPassword = 'browserless-operator-password';

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

    const indexHtml = await requestText(`${baseUrl}/`);
    assertContains(indexHtml, '<script src="scripts/main.js"></script>', 'homepage');

    const contactHtml = await requestText(`${baseUrl}/contatti.html`);
    assertContains(contactHtml, 'id="contact-form"', 'contatti');
    assertContains(contactHtml, 'name="email"', 'contatti');

    const landingHtml = await requestText(`${baseUrl}/transfer-stazione-napoli-ischia.html`);
    assertContains(landingHtml, 'Richiedi disponibilita', 'landing transfer');
    assertContains(landingHtml, 'wa.me/390813331053', 'landing transfer');

    const opsHtml = await requestText(`${baseUrl}/ops.html`);
    assertContains(opsHtml, 'Executive Summary', 'ops');
    assertContains(opsHtml, 'Snapshot Storici', 'ops');
    assertContains(opsHtml, 'Segmenti Lingua e Dispositivo', 'ops');

    const mainJs = await requestText(`${baseUrl}/scripts/main.js`);
    assertContains(mainJs, 'device_type', 'scripts/main.js');
    assertContains(mainJs, '/api/analytics-events', 'scripts/main.js');

    const login = await requestJson(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: smokeOperatorEmail,
        password: smokeOperatorPassword,
      }),
    });

    await requestJson(`${baseUrl}/api/analytics-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'cta_click',
        session_id: 'browserless-session',
        lang: 'it',
        device_type: 'mobile',
        page_path: '/transfer-stazione-napoli-ischia.html',
        page_title: 'Browserless Smoke',
        funnel_step: 'cta_click',
        utm: {
          utm_source: 'browserless',
          utm_medium: 'qa',
          utm_campaign: 'smoke',
        },
      }),
    });

    const analytics = await requestJson(`${baseUrl}/api/analytics-events`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${login.token}` },
    });

    if (!analytics.items || !analytics.items.length) {
      throw new Error('Nessun analytics event restituito dalla dashboard');
    }
    if (!analytics.items.some((item) => item.deviceType === 'mobile')) {
      throw new Error('deviceType non presente nei dati analytics letti');
    }

    const exportJson = await fetch(`${baseUrl}/api/analytics-events/export?format=json`, {
      headers: { Authorization: `Bearer ${login.token}` },
    });
    if (!exportJson.ok) {
      throw new Error(`export json fallito: ${exportJson.status}`);
    }

    const exportCsv = await fetch(`${baseUrl}/api/analytics-events/export?format=csv`, {
      headers: { Authorization: `Bearer ${login.token}` },
    });
    const csvBody = await exportCsv.text();
    if (!exportCsv.ok || !csvBody.includes('deviceType')) {
      throw new Error('export csv analytics non valido');
    }

    console.log('BROWSERLESS_SMOKE_OK');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tempDataDir, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(`BROWSERLESS_SMOKE_FAIL: ${error.message}`);
  process.exit(1);
});
