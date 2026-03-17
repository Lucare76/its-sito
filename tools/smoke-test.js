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
