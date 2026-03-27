const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const port = 4500 + Math.floor(Math.random() * 200);
  const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'its-playwright-'));
  const smokeOperatorEmail = 'playwright.operator@its.local';
  const smokeOperatorPassword = 'playwright-operator-password';

  process.env.PORT = String(port);
  process.env.DATA_DIR = tempDataDir;
  process.env.DB_PATH = path.join(tempDataDir, 'db.json');
  process.env.BOOTSTRAP_OPERATOR_EMAIL = smokeOperatorEmail;
  process.env.BOOTSTRAP_OPERATOR_PASSWORD = smokeOperatorPassword;

  const baseUrl = `http://localhost:${port}`;
  const { startServer } = require('../server');
  const server = startServer(port);
  let browser;

  try {
    await sleep(1500);
    browser = await chromium.launch({ headless: true });

    const publicContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const publicPage = await publicContext.newPage();

    const landingChecks = [
      {
        path: '/transfer-stazione-napoli-ischia.html',
        headingText: 'Transfer Stazione Napoli',
      },
      {
        path: '/transfer-napoli-ischia.html',
        headingText: 'Transfer Napoli',
      },
      {
        path: '/transfer-napoli-aeroporto.html',
        headingText: 'Transfer Napoli aeroporto Ischia',
      },
      {
        path: '/en/transfer-naples-train-station-ischia.html',
        headingText: 'Naples Train Station',
      },
    ];

    for (const landing of landingChecks) {
      await publicPage.goto(`${baseUrl}${landing.path}?utm_source=google&utm_medium=cpc&utm_campaign=smoke`, {
        waitUntil: 'networkidle',
      });
      const landingHeading = await publicPage.locator('h1').innerText();
      if (!landingHeading.includes(landing.headingText)) {
        throw new Error(`Landing non caricata correttamente: ${landing.path}`);
      }

      const mainScriptCount = await publicPage.locator('script[src$="scripts/main.js"]').count();
      if (mainScriptCount < 1) {
        throw new Error(`Script principale mancante o duplicato in ${landing.path}`);
      }

      const whatsappCount = await publicPage.locator('a[href*="wa.me/"]').count();
      if (whatsappCount < 1) {
        throw new Error(`Link WhatsApp mancante in ${landing.path}`);
      }
    }

    await publicPage.goto(`${baseUrl}/contatti.html?utm_source=google&utm_medium=cpc&utm_campaign=smoke`, {
      waitUntil: 'networkidle',
    });

    await publicPage.fill('input[name="name"]', 'Playwright Smoke');
    await publicPage.fill('input[name="email"]', 'playwright.smoke@example.com');
    await publicPage.fill('input[name="route"]', 'Napoli Centrale -> Ischia Porto');
    await publicPage.fill('input[name="date"]', '2026-04-10');
    await publicPage.fill('input[name="people"]', '2');
    await publicPage.click('button[type="submit"]');
    await publicPage.waitForSelector('#contact-feedback');

    await publicPage.locator('a[href*="wa.me/"]').first().click({ noWaitAfter: true });

    console.log('PLAYWRIGHT_SMOKE_OK');
  } finally {
    if (browser) {
      await browser.close();
    }
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tempDataDir, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(`PLAYWRIGHT_SMOKE_FAIL: ${error.message}`);
  process.exit(1);
});
