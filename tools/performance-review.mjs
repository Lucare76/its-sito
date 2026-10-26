// Run from a directory containing baseline/ and candidate/ HTTP servers on 4174/4173.
// No production writes, form submissions, credentials or deployment commands.
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const auditRoot = process.env.AUDIT_TOOLS_ROOT;
if (!auditRoot) throw new Error('Set AUDIT_TOOLS_ROOT to the isolated audit node_modules directory');
const { default: lighthouse } = await import(pathToFileURL(`${auditRoot}/lighthouse/core/index.js`));
const { launch } = await import(pathToFileURL(`${auditRoot}/chrome-launcher/dist/index.js`));
const output = 'performance-results';
await mkdir(output, { recursive: true });
const results = [];
for (const [name, url] of [['baseline', 'http://127.0.0.1:4174/'], ['candidate', 'http://127.0.0.1:4173/']]) {
  for (let run = 1; run <= 3; run++) {
    const chrome = await launch({ chromePath: process.env.CHROME_PATH, chromeFlags: ['--headless', '--no-sandbox', '--disable-dev-shm-usage'] });
    try {
      const { lhr } = await lighthouse(url, { port: chrome.port, onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'] });
      if (lhr.runtimeError) throw new Error(JSON.stringify(lhr.runtimeError));
      await writeFile(`${output}/${name}-${run}.json`, JSON.stringify(lhr, null, 2));
      results.push({ name, run, performance: lhr.categories.performance.score * 100, lcp: lhr.audits['largest-contentful-paint'].numericValue, cls: lhr.audits['cumulative-layout-shift'].numericValue, fcp: lhr.audits['first-contentful-paint'].numericValue, bytes: lhr.audits['total-byte-weight'].numericValue });
    } finally { await chrome.kill(); }
  }
}
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ['--no-sandbox'] });
try {
  for (const width of [390, 1440]) {
    for (const [name, port] of [['baseline', 4174], ['candidate', 4173]]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
      await page.screenshot({ path: `${output}/${name}-${width}.png`, fullPage: true });
      const reject = page.locator('[data-cookie-choice="reject"]');
      if (await reject.count()) await reject.click();
      if (name === 'candidate') {
        const logoMatch = await page.evaluate(async () => {
          const readPixels = async src => {
            const img = new Image(); img.src = src; await img.decode();
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
            return { width: canvas.width, height: canvas.height, pixels: ctx.getImageData(0, 0, canvas.width, canvas.height).data };
          };
          const [original, optimized] = await Promise.all([
            readPixels('/assets/logo-nav.png'), readPixels('/assets/logo-nav-lossless.png')
          ]);
          return original.width === optimized.width && original.height === optimized.height
            && original.pixels.every((value, i) => value === optimized.pixels[i]);
        });
        if (!logoMatch) throw new Error('Logo pixels changed');
        const logo = page.locator('.site-nav-logo');
        if (!(await logo.getAttribute('src')).includes('logo-nav-lossless.png')) throw new Error('Optimized logo not selected');
        console.log(`Logo: identical decoded pixels at viewport ${width}`);

        const hero = await page.locator('.hero-background-image').evaluate(img => ({ src: img.currentSrc, loaded: img.complete && img.naturalWidth > 0 }));
        if (!hero.loaded || (width === 390 && !hero.src.includes('1200.webp'))) throw new Error('Wrong or broken hero image');
        await page.locator('#flotta').scrollIntoViewIfNeeded();
        await page.waitForFunction(() => [...document.querySelectorAll('.fleet-image')].every(i => i.complete && i.naturalWidth > 0));
        const images = await page.locator('.fleet-image').evaluateAll(items => items.map(i => i.currentSrc));
        if (images.some(src => !/-\d+\.webp$/.test(src))) throw new Error('Original oversized fleet image requested');
        if (width === 390) {
          await page.locator('#menu-toggle').click();
          if (await page.locator('#menu-toggle').getAttribute('aria-expanded') !== 'true') throw new Error('Menu failed');
          await page.locator('#menu-toggle').click();
        }
        if (await page.locator('#hero-booking-form').count() !== 1) throw new Error('Booking form missing');
        for (let i = 0; i < 3; i++) {
          await page.locator('.fleet-image').nth(i).scrollIntoViewIfNeeded();
          await page.waitForFunction(index => {
            const image = document.querySelectorAll('.fleet-image')[index];
            for (let el = image; el && el !== document.body; el = el.parentElement) {
              if (Number(getComputedStyle(el).opacity) < 0.99) return false;
            }
            return true;
          }, i);
          await page.screenshot({ path: `${output}/fleet-${width}-${i}.png` });
        }
      }
      await page.close();
    }
  }
} finally { await browser.close(); }
const median = xs => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
let summary = '# Homepage: controlled mobile comparison\n\nThree cold runs per revision, identical localhost transport and Lighthouse 13.5.0 defaults. These are laboratory measurements, not production TTFB or field data.\n\n| Metric (median) | Baseline | Candidate |\n|---|---:|---:|\n';
for (const key of ['performance', 'lcp', 'cls', 'fcp', 'bytes']) summary += `| ${key} | ${median(results.filter(r => r.name === 'baseline').map(r => r[key])).toFixed(3)} | ${median(results.filter(r => r.name === 'candidate').map(r => r[key])).toFixed(3)} |\n`;
await writeFile(`${output}/summary.md`, summary);
console.log(summary);
