const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dns = require('dns');
const nodemailer = require('nodemailer');

// Prefer IPv4 for all DNS lookups (fixes SMTP on IPv6-only or dual-stack hosts)
dns.setDefaultResultOrder('ipv4first');

function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    return;
  }

  const rows = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  rows.forEach((row) => {
    const line = row.trim();
    if (!line || line.startsWith('#')) {
      return;
    }
    const separator = line.indexOf('=');
    if (separator <= 0) {
      return;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

loadEnvFile();

const ROOT_DIR = __dirname;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT_DIR, 'data'));
const DB_PATH = path.resolve(process.env.DB_PATH || path.join(DATA_DIR, 'db.json'));
const STATIC_DIRS = [ROOT_DIR];
const BLOCKED_STATIC_SEGMENTS = new Set(['.git', '.pnpm-store', 'node_modules', 'data', 'tools']);
const BLOCKED_ROOT_STATIC_FILES = new Set([
  '.env',
  '.env.example',
  '.eslintignore',
  '.eslintrc.cjs',
  '.gitignore',
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'server.js',
  'tailwind.config.js',
  'README.md'
]);

const PORT = Number(process.env.PORT || 4000);
const AUTH_SECRET = process.env.AUTH_SECRET || 'its-beta-change-this-secret';
const AUTH_SALT = process.env.AUTH_SALT || 'its-beta-static-salt';
const BOOKING_RATE_LIMIT_MAX = Number(process.env.BOOKING_RATE_LIMIT_MAX || 20);
const BOOKING_RATE_LIMIT_WINDOW_MS = Number(process.env.BOOKING_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const ANALYTICS_RATE_LIMIT_MAX = Number(process.env.ANALYTICS_RATE_LIMIT_MAX || 120);
const ANALYTICS_RATE_LIMIT_WINDOW_MS = Number(process.env.ANALYTICS_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const LOGIN_RATE_LIMIT_MAX = Number(process.env.LOGIN_RATE_LIMIT_MAX || 25);
const LOGIN_RATE_LIMIT_WINDOW_MS = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const BOOTSTRAP_OPERATOR_EMAIL = String(process.env.BOOTSTRAP_OPERATOR_EMAIL || '').trim();
const BOOTSTRAP_OPERATOR_PASSWORD = String(process.env.BOOTSTRAP_OPERATOR_PASSWORD || '');
const BOOTSTRAP_ADMIN_EMAIL = String(process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim();
const BOOTSTRAP_ADMIN_PASSWORD = String(process.env.BOOTSTRAP_ADMIN_PASSWORD || '');
const BOOTSTRAP_AGENCY_EMAIL = String(process.env.BOOTSTRAP_AGENCY_EMAIL || '').trim();
const BOOTSTRAP_AGENCY_PASSWORD = String(process.env.BOOTSTRAP_AGENCY_PASSWORD || '');
const SMTP_HOST = String(process.env.SMTP_HOST || '').trim();
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = String(process.env.SMTP_SECURE || '').trim().toLowerCase() === 'true';
const SMTP_USER = String(process.env.SMTP_USER || '').trim();
const SMTP_PASS = String(process.env.SMTP_PASS || '');
const BOOKING_NOTIFICATION_TO = String(process.env.BOOKING_NOTIFICATION_TO || '').trim();
const BOOKING_NOTIFICATION_FROM = String(process.env.BOOKING_NOTIFICATION_FROM || SMTP_USER || '').trim();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.avif': 'image/avif',
  '.webp': 'image/webp'
};

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

let mailTransporter = null;

function getMailTransporter() {
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !BOOKING_NOTIFICATION_TO || !BOOKING_NOTIFICATION_FROM) {
    return null;
  }

  if (!mailTransporter) {
    mailTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    });
  }

  return mailTransporter;
}

function nowIso() {
  return new Date().toISOString();
}

const rateLimitStore = new Map();
const tokenBlacklist = new Set();

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown-ip';
}

function checkRateLimit(req, scope, max, windowMs) {
  const ip = getClientIp(req);
  const key = `${scope}:${ip}`;
  const now = Date.now();
  const existing = rateLimitStore.get(key);
  if (!existing || now > existing.resetAt) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + windowMs
    });
    return { allowed: true, remaining: max - 1, resetAt: now + windowMs };
  }

  existing.count += 1;
  rateLimitStore.set(key, existing);
  if (existing.count > max) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  return { allowed: true, remaining: Math.max(max - existing.count, 0), resetAt: existing.resetAt };
}

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, 'base64').toString('utf8');
}

function hashPassword(password) {
  return crypto.scryptSync(password, AUTH_SALT, 64).toString('hex');
}

function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function hashPasswordWithSalt(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function signToken(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerPart = base64UrlEncode(JSON.stringify(header));
  const payloadPart = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(`${headerPart}.${payloadPart}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${headerPart}.${payloadPart}.${signature}`;
}

function verifyToken(token) {
  if (!token) {
    return null;
  }

  if (tokenBlacklist.has(token)) {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const [headerPart, payloadPart, signature] = parts;
  const expected = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(`${headerPart}.${payloadPart}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (signature !== expected) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(payloadPart));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch (error) {
    return null;
  }
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    agencyId: user.agencyId || null
  };
}

function buildBootstrapUsers() {
  const users = [];

  function addBootstrapUser(config) {
    if (!config.email || !config.password) {
      return;
    }

    const salt = generateSalt();
    users.push({
      id: config.id,
      name: config.name,
      email: config.email,
      role: config.role,
      agencyId: config.agencyId || null,
      salt,
      passwordHash: hashPasswordWithSalt(config.password, salt)
    });
  }

  addBootstrapUser({
    id: 'usr_operator_1',
    name: 'Operatore ITS',
    email: BOOTSTRAP_OPERATOR_EMAIL,
    role: 'operator',
    password: BOOTSTRAP_OPERATOR_PASSWORD
  });

  addBootstrapUser({
    id: 'usr_admin_1',
    name: 'Admin ITS',
    email: BOOTSTRAP_ADMIN_EMAIL,
    role: 'admin',
    password: BOOTSTRAP_ADMIN_PASSWORD
  });

  addBootstrapUser({
    id: 'usr_agency_1',
    name: 'Agenzia',
    email: BOOTSTRAP_AGENCY_EMAIL,
    role: 'agency',
    agencyId: 'agency_bootstrap',
    password: BOOTSTRAP_AGENCY_PASSWORD
  });

  return users;
}

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_PATH)) {
    const bootstrapUsers = buildBootstrapUsers();
    const seed = {
      users: bootstrapUsers,
      bookings: [],
      analyticsEvents: [],
      analyticsSnapshots: []
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(seed, null, 2), 'utf8');
    log(`DB inizializzato in ${DB_PATH}`);
    if (!bootstrapUsers.length) {
      log('Nessun utente bootstrap configurato: imposta variabili BOOTSTRAP_* per abilitare login iniziale');
    }
    return;
  }

  const bootstrapUsers = buildBootstrapUsers();
  if (!bootstrapUsers.length) {
    return;
  }

  try {
    const existing = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const hasUsers = Array.isArray(existing.users) && existing.users.length > 0;
    const normalized = {
      users: Array.isArray(existing.users) ? existing.users : [],
      bookings: Array.isArray(existing.bookings) ? existing.bookings : [],
      analyticsEvents: Array.isArray(existing.analyticsEvents) ? existing.analyticsEvents : [],
      analyticsSnapshots: Array.isArray(existing.analyticsSnapshots) ? existing.analyticsSnapshots : []
    };

    const needsWrite = !Array.isArray(existing.analyticsEvents) || !Array.isArray(existing.bookings) || !Array.isArray(existing.users) || !Array.isArray(existing.analyticsSnapshots);
    if (needsWrite) {
      fs.writeFileSync(DB_PATH, JSON.stringify(normalized, null, 2), 'utf8');
    }

    if (hasUsers) {
      return;
    }

    const merged = {
      users: bootstrapUsers,
      bookings: normalized.bookings,
      analyticsEvents: normalized.analyticsEvents,
      analyticsSnapshots: normalized.analyticsSnapshots
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(merged, null, 2), 'utf8');
    log(`Utenti bootstrap inseriti in ${DB_PATH}`);
  } catch (error) {
    log(`Impossibile aggiornare utenti bootstrap in ${DB_PATH}: ${error.message}`);
  }
}

function readDb() {
  ensureDb();
  const raw = fs.readFileSync(DB_PATH, 'utf8');
  return JSON.parse(raw);
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

function normalizeDb(db) {
  return {
    ...db,
    users: Array.isArray(db.users) ? db.users : [],
    bookings: Array.isArray(db.bookings) ? db.bookings : [],
    analyticsEvents: Array.isArray(db.analyticsEvents) ? db.analyticsEvents : [],
    analyticsSnapshots: Array.isArray(db.analyticsSnapshots) ? db.analyticsSnapshots : []
  };
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendBookingNotificationEmail(booking) {
  const transporter = getMailTransporter();
  if (!transporter) {
    return { sent: false, skipped: true, reason: 'smtp_not_configured' };
  }

  const details = booking.details ? escapeHtml(booking.details) : 'Nessun dettaglio aggiuntivo';
  const time = booking.time ? escapeHtml(booking.time) : 'Non indicato';
  const phone = booking.phone ? escapeHtml(booking.phone) : 'Non indicato';
  const agencyId = booking.agencyId ? escapeHtml(booking.agencyId) : 'Nessuna agenzia';

  const subject = `[ITS] Nuova richiesta ${booking.reference}`;
  const text = [
    'Nuova richiesta dal sito ITS',
    `Reference: ${booking.reference}`,
    `Nome: ${booking.name}`,
    `Email: ${booking.email}`,
    `Telefono: ${phone}`,
    `Servizio: ${booking.service}`,
    `Tratta: ${booking.route}`,
    `Data: ${booking.date}`,
    `Orario: ${time}`,
    `Source: ${booking.source}`,
    `Agency ID: ${agencyId}`,
    `Dettagli: ${booking.details || 'Nessun dettaglio aggiuntivo'}`,
    `Creato il: ${booking.createdAt}`
  ].join('\n');
  const html = `
    <h2>Nuova richiesta dal sito ITS</h2>
    <p><strong>Reference:</strong> ${escapeHtml(booking.reference)}</p>
    <p><strong>Nome:</strong> ${escapeHtml(booking.name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(booking.email)}</p>
    <p><strong>Telefono:</strong> ${phone}</p>
    <p><strong>Servizio:</strong> ${escapeHtml(booking.service)}</p>
    <p><strong>Tratta:</strong> ${escapeHtml(booking.route)}</p>
    <p><strong>Data:</strong> ${escapeHtml(booking.date)}</p>
    <p><strong>Orario:</strong> ${time}</p>
    <p><strong>Source:</strong> ${escapeHtml(booking.source)}</p>
    <p><strong>Agency ID:</strong> ${agencyId}</p>
    <p><strong>Creato il:</strong> ${escapeHtml(booking.createdAt)}</p>
    <p><strong>Dettagli:</strong><br>${details.replace(/\n/g, '<br>')}</p>
  `;

  await transporter.sendMail({
    from: BOOKING_NOTIFICATION_FROM,
    to: BOOKING_NOTIFICATION_TO,
    replyTo: booking.email,
    subject,
    text,
    html
  });

  return { sent: true, skipped: false };
}

function sanitizeAnalyticsSnapshot(body) {
  const filters = body && typeof body.filters === 'object' ? body.filters : {};
  const totals = body && typeof body.totals === 'object' ? body.totals : {};
  const arrays = ['funnel', 'previousPeriodFunnel', 'topPages', 'healthScore', 'topUtm', 'topPageUtm', 'segmentsByLanguage', 'segmentsByDevice', 'alerts'];
  const normalized = arrays.reduce((accumulator, key) => {
    accumulator[key] = Array.isArray(body[key]) ? body[key] : [];
    return accumulator;
  }, {});

  return {
    id: String(body.id || `snap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`).trim(),
    exportedAt: String(body.exportedAt || nowIso()).trim(),
    name: String(body.name || '').trim(),
    note: String(body.note || '').trim(),
    pinned: Boolean(body.pinned),
    tags: Array.isArray(body.tags) ? body.tags.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 10) : [],
    createdBy: body && typeof body.createdBy === 'object'
      ? {
        id: String(body.createdBy.id || '').trim(),
        name: String(body.createdBy.name || '').trim(),
        role: String(body.createdBy.role || '').trim()
      }
      : {
        id: '',
        name: '',
        role: ''
      },
    filters: {
      range: String(filters.range || '').trim(),
      page: String(filters.page || '').trim()
    },
    totals: {
      events: Number(totals.events || 0),
      cta: Number(totals.cta || 0),
      formOpen: Number(totals.formOpen || 0),
      formSubmit: Number(totals.formSubmit || 0),
      whatsapp: Number(totals.whatsapp || 0)
    },
    ...normalized
  };
}

function validateAnalyticsSnapshot(input) {
  const errors = [];
  if (!input.id) errors.push('snapshot id obbligatorio');
  if (!input.exportedAt) errors.push('exportedAt obbligatorio');
  if (input.id && input.id.length > 120) errors.push('snapshot id troppo lungo');
  if (input.name && input.name.length > 120) errors.push('snapshot name troppo lungo');
  if (input.note && input.note.length > 500) errors.push('snapshot note troppo lunga');
  if (Array.isArray(input.tags) && input.tags.join(',').length > 240) errors.push('snapshot tags troppo lunghe');
  return errors;
}

function sortSnapshots(items) {
  return [...items].sort((a, b) => {
    const pinDelta = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
    if (pinDelta !== 0) {
      return pinDelta;
    }
    return new Date(b.exportedAt) - new Date(a.exportedAt);
  });
}

function sendJson(res, statusCode, payload, extraHeaders) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    ...getSecurityHeaders(),
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end(body);
}

function sendText(res, statusCode, body) {
  res.writeHead(statusCode, {
    ...getSecurityHeaders(),
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function sendCsv(res, filename, body) {
  res.writeHead(200, {
    ...getSecurityHeaders(),
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function getSecurityHeaders() {
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'"
  };
  if (process.env.NODE_ENV === 'production') {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  }
  return headers;
}

function extractAuthUser(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const payload = verifyToken(token);
  if (!payload) {
    return null;
  }

  const db = readDb();
  const user = db.users.find((item) => item.id === payload.sub);
  if (!user) {
    return null;
  }
  return sanitizeUser(user);
}

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        resolve(body);
      } catch (error) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', (error) => reject(error));
  });
}

function isAllowedRole(user, roles) {
  return Boolean(user && roles.includes(user.role));
}

function buildBookingReference(bookings) {
  const year = new Date().getFullYear();
  const yearly = bookings.filter((item) => item.reference && item.reference.startsWith(`ITS-${year}-`)).length;
  return `ITS-${year}-${String(yearly + 1).padStart(4, '0')}`;
}

function normalizeStatus(input) {
  const value = String(input || '').trim().toUpperCase();
  const allowed = ['PENDING_CONFIRMATION', 'CONFIRMED', 'CANCELLED'];
  return allowed.includes(value) ? value : null;
}

function sanitizeBookingInput(body) {
  return {
    name: String(body.name || '').trim(),
    email: String(body.email || '').trim(),
    phone: String(body.phone || '').trim(),
    service: String(body.service || '').trim(),
    route: String(body.route || '').trim(),
    date: String(body.date || '').trim(),
    time: String(body.time || '').trim(),
    details: String(body.details || '').trim(),
    source: String(body.source || 'PUBLIC_WEB').trim(),
    agencyId: body.agencyId ? String(body.agencyId).trim() : null,
    website: String(body.website || '').trim()
  };
}

function sanitizeAnalyticsEvent(body) {
  const utm = body && typeof body.utm === 'object' ? body.utm : {};
  return {
    event: String(body.event || '').trim(),
    sessionId: String(body.sessionId || '').trim(),
    lang: String(body.lang || '').trim(),
    deviceType: String(body.device_type || body.deviceType || '').trim(),
    pagePath: String(body.page_path || body.pagePath || '').trim(),
    pageTitle: String(body.page_title || body.pageTitle || '').trim(),
    source: String(body.source || '').trim(),
    label: String(body.label || '').trim(),
    href: String(body.href || '').trim(),
    formId: String(body.form_id || body.formId || '').trim(),
    errorType: String(body.error_type || body.errorType || '').trim(),
    errorMessage: String(body.error_message || body.errorMessage || '').trim(),
    missingFields: Array.isArray(body.missing_fields || body.missingFields)
      ? (body.missing_fields || body.missingFields).map((item) => String(item).trim()).filter(Boolean)
      : [],
    funnelStep: String(body.funnel_step || body.funnelStep || '').trim(),
    utm: {
      source: String(utm.utm_source || utm.source || '').trim(),
      medium: String(utm.utm_medium || utm.medium || '').trim(),
      campaign: String(utm.utm_campaign || utm.campaign || '').trim()
    }
  };
}

function validateAnalyticsEvent(input) {
  const errors = [];
  if (!input.event) errors.push('event obbligatorio');
  if (input.event && input.event.length > 64) errors.push('event troppo lungo');
  if (input.sessionId && input.sessionId.length > 120) errors.push('sessionId troppo lungo');
  if (input.label && input.label.length > 240) errors.push('label troppo lunga');
  if (input.errorMessage && input.errorMessage.length > 500) errors.push('errorMessage troppo lungo');
  return errors;
}

function csvEscape(value) {
  const normalized = value === null || value === undefined ? '' : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

function serializeAnalyticsEventsCsv(items) {
  const header = [
    'id',
    'createdAt',
    'event',
    'sessionId',
    'lang',
    'deviceType',
    'pagePath',
    'pageTitle',
    'source',
    'label',
    'href',
    'formId',
    'errorType',
    'errorMessage',
    'missingFields',
    'funnelStep',
    'utmSource',
    'utmMedium',
    'utmCampaign'
  ];

  const rows = items.map((item) => [
    item.id,
    item.createdAt,
    item.event,
    item.sessionId,
    item.lang,
    item.deviceType,
    item.pagePath,
    item.pageTitle,
    item.source,
    item.label,
    item.href,
    item.formId,
    item.errorType,
    item.errorMessage,
    Array.isArray(item.missingFields) ? item.missingFields.join('|') : '',
    item.funnelStep,
    item.utm && item.utm.source,
    item.utm && item.utm.medium,
    item.utm && item.utm.campaign
  ].map(csvEscape).join(','));

  return [header.join(','), ...rows].join('\n');
}

function getRangeWindowMs(range) {
  const value = String(range || '30d').trim().toLowerCase();
  const ranges = {
    '1d': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000
  };
  return value === 'all' ? null : (ranges[value] || ranges['30d']);
}

function filterAnalyticsItems(items, options = {}) {
  const page = String(options.page || 'all').trim();
  const range = String(options.range || '30d').trim().toLowerCase();
  const now = Date.now();
  const windowMs = getRangeWindowMs(range);

  return items.filter((item) => {
    if (page !== 'all' && String(item.pagePath || '').trim() !== page) {
      return false;
    }
    if (!windowMs) {
      return true;
    }
    const createdAt = Date.parse(item.createdAt || '');
    return Number.isFinite(createdAt) && (now - createdAt) <= windowMs;
  });
}

function filterPreviousPeriodAnalyticsItems(items, options = {}) {
  const page = String(options.page || 'all').trim();
  const range = String(options.range || '30d').trim().toLowerCase();
  const now = Date.now();
  const windowMs = getRangeWindowMs(range);
  if (!windowMs) {
    return [];
  }

  return items.filter((item) => {
    if (page !== 'all' && String(item.pagePath || '').trim() !== page) {
      return false;
    }
    const createdAt = Date.parse(item.createdAt || '');
    if (!Number.isFinite(createdAt)) {
      return false;
    }
    const age = now - createdAt;
    return age > windowMs && age <= (windowMs * 2);
  });
}

function countAnalyticsEvent(items, eventName) {
  return items.filter((item) => item.event === eventName).length;
}

function buildFunnelStats(items) {
  const steps = [
    { event: 'cta_click', label: 'CTA click' },
    { event: 'form_open', label: 'Form open' },
    { event: 'form_submit', label: 'Form submit' },
    { event: 'whatsapp_click', label: 'WhatsApp' }
  ];

  return steps.map((step, index) => {
    const total = countAnalyticsEvent(items, step.event);
    const previousTotal = index === 0 ? total : countAnalyticsEvent(items, steps[index - 1].event);
    const conversion = index === 0 ? 100 : (previousTotal > 0 ? (total / previousTotal) * 100 : 0);
    const dropoff = index === 0 ? 0 : Math.max(previousTotal - total, 0);
    return {
      step: step.label,
      total,
      conversionFromPrevious: index === 0 ? 100 : Math.round(conversion),
      dropoffFromPrevious: index === 0 ? 0 : dropoff
    };
  });
}

function buildSegmentRows(items, fieldName, fallbackLabel) {
  const grouped = new Map();
  items.forEach((item) => {
    const key = String(item[fieldName] || '').trim() || fallbackLabel;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(item);
  });

  return Array.from(grouped.entries()).map(([key, groupItems]) => {
    const funnel = buildFunnelStats(groupItems);
    const cta = funnel[0].total;
    const whatsapp = funnel[3].total;
    return {
      key,
      cta,
      submit: funnel[2].total,
      whatsapp,
      finalConversion: cta > 0 ? Math.round((whatsapp / cta) * 100) : 0
    };
  }).sort((a, b) => b.finalConversion - a.finalConversion);
}

function computeHealthScore(funnel) {
  const cta = funnel[0].total;
  const open = funnel[1].total;
  const submit = funnel[2].total;
  const whatsapp = funnel[3].total;
  const openRate = cta > 0 ? (open / cta) * 100 : 0;
  const submitRate = open > 0 ? (submit / open) * 100 : 0;
  const whatsappRate = submit > 0 ? (whatsapp / submit) * 100 : 0;
  const finalRate = cta > 0 ? (whatsapp / cta) * 100 : 0;
  const weighted = (openRate * 0.2) + (submitRate * 0.3) + (whatsappRate * 0.2) + (finalRate * 0.3);
  return Math.round(Math.min(Math.max(weighted, 0), 100));
}

function buildPageRows(items) {
  const grouped = new Map();
  items.forEach((item) => {
    const key = String(item.pagePath || '').trim();
    if (!key) return;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(item);
  });

  return Array.from(grouped.entries()).map(([pagePath, groupItems]) => {
    const funnel = buildFunnelStats(groupItems);
    const cta = funnel[0].total;
    const whatsapp = funnel[3].total;
    return {
      pagePath,
      cta,
      open: funnel[1].total,
      submit: funnel[2].total,
      whatsapp,
      finalConversion: cta > 0 ? Math.round((whatsapp / cta) * 100) : 0,
      healthScore: computeHealthScore(funnel)
    };
  }).sort((a, b) => b.finalConversion - a.finalConversion);
}

function buildBookingKpis(bookings) {
  const total = bookings.length;
  const confirmed = bookings.filter((item) => String(item.status || '').toUpperCase() === 'CONFIRMED');
  const cancelled = bookings.filter((item) => String(item.status || '').toUpperCase() === 'CANCELLED');
  const pending = bookings.filter((item) => String(item.status || '').toUpperCase() === 'PENDING_CONFIRMATION');
  const confirmationTimes = confirmed.map((item) => {
    const createdAt = Date.parse(item.createdAt || '');
    const statusEvents = Array.isArray(item.statusEvents) ? item.statusEvents : [];
    const confirmEvent = statusEvents.find((entry) => String(entry.note || '').includes('CONFIRMED') || String(entry.note || '').includes('Conferm'));
    const confirmedAt = confirmEvent ? Date.parse(confirmEvent.at || '') : NaN;
    if (!Number.isFinite(createdAt) || !Number.isFinite(confirmedAt)) {
      return null;
    }
    return (confirmedAt - createdAt) / (1000 * 60 * 60);
  }).filter((value) => Number.isFinite(value) && value >= 0);

  return {
    total,
    confirmed: confirmed.length,
    cancelled: cancelled.length,
    pending: pending.length,
    confirmRate: total > 0 ? Math.round((confirmed.length / total) * 100) : 0,
    averageConfirmationHours: confirmationTimes.length
      ? Number((confirmationTimes.reduce((sum, value) => sum + value, 0) / confirmationTimes.length).toFixed(2))
      : 0
  };
}

function buildInsightsReport(db, options = {}) {
  const analyticsItems = Array.isArray(db.analyticsEvents) ? db.analyticsEvents : [];
  const filteredItems = filterAnalyticsItems(analyticsItems, options);
  const previousItems = filterPreviousPeriodAnalyticsItems(analyticsItems, options);
  const pageRows = buildPageRows(filteredItems);

  return {
    exportedAt: nowIso(),
    filters: {
      range: String(options.range || '30d').trim().toLowerCase(),
      page: String(options.page || 'all').trim()
    },
    totals: {
      events: filteredItems.length,
      cta: countAnalyticsEvent(filteredItems, 'cta_click'),
      formOpen: countAnalyticsEvent(filteredItems, 'form_open'),
      formSubmit: countAnalyticsEvent(filteredItems, 'form_submit'),
      whatsapp: countAnalyticsEvent(filteredItems, 'whatsapp_click')
    },
    funnel: buildFunnelStats(filteredItems),
    previousPeriodFunnel: buildFunnelStats(previousItems),
    topPages: pageRows.slice(0, 10).map((item) => ({
      pagePath: item.pagePath,
      cta: item.cta,
      open: item.open,
      submit: item.submit,
      whatsapp: item.whatsapp,
      finalConversion: item.finalConversion
    })),
    healthScore: pageRows.slice(0, 10).sort((a, b) => b.healthScore - a.healthScore).map((item) => ({
      pagePath: item.pagePath,
      score: item.healthScore,
      status: item.healthScore >= 75 ? 'Buono' : (item.healthScore >= 45 ? 'Medio' : 'Critico'),
      cta: item.cta,
      submit: item.submit,
      whatsapp: item.whatsapp
    })),
    segmentsByLanguage: buildSegmentRows(filteredItems, 'lang', 'n/d'),
    segmentsByDevice: buildSegmentRows(filteredItems, 'deviceType', 'n/d'),
    bookingKpis: buildBookingKpis(Array.isArray(db.bookings) ? db.bookings : [])
  };
}

function validateBookingInput(input) {
  const errors = [];
  if (!input.service) errors.push('service obbligatorio');
  if (!input.route) errors.push('route obbligatorio');
  if (!input.date) errors.push('date obbligatorio');
  if (!input.name) errors.push('name obbligatorio');
  if (!input.email) errors.push('email obbligatorio');
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    errors.push('email non valida');
  }
  if (input.date && !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    errors.push('date non valida (formato YYYY-MM-DD)');
  }
  if (input.website) {
    errors.push('richiesta non valida');
  }
  return errors;
}

function handleApi(req, res, pathname) {
  if (pathname === '/api/health' && req.method === 'GET') {
    return sendJson(res, 200, {
      ok: true,
      service: 'its-beta-api',
      now: nowIso()
    });
  }

  if (pathname === '/api/auth/login' && req.method === 'POST') {
    const limit = checkRateLimit(req, 'login', LOGIN_RATE_LIMIT_MAX, LOGIN_RATE_LIMIT_WINDOW_MS);
    if (!limit.allowed) {
      const retryAfterSec = Math.ceil(Math.max(limit.resetAt - Date.now(), 0) / 1000);
      return sendJson(res, 429, {
        error: 'Troppi tentativi login, riprova più tardi',
        retryAfterMs: Math.max(limit.resetAt - Date.now(), 0)
      }, { 'Retry-After': String(retryAfterSec) });
    }

    return parseRequestBody(req)
      .then((body) => {
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');
        const ip = getClientIp(req);
        const db = readDb();
        const user = db.users.find((item) => item.email.toLowerCase() === email);

        // Always compute a hash to prevent timing-based user enumeration.
        const candidateSalt = user ? (user.salt || AUTH_SALT) : AUTH_SALT;
        const candidateHash = hashPasswordWithSalt(password, candidateSalt);
        const storedHash = user ? user.passwordHash : hashPasswordWithSalt('', candidateSalt);

        let passwordMatch = false;
        try {
          passwordMatch = crypto.timingSafeEqual(
            Buffer.from(candidateHash, 'hex'),
            Buffer.from(storedHash, 'hex')
          );
        } catch (_) {
          passwordMatch = false;
        }

        if (!user || !passwordMatch) {
          log(`LOGIN_FAIL ip=${ip} email=${email}`);
          return sendJson(res, 401, { error: 'Credenziali non valide' });
        }

        const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 8;
        const token = signToken({
          sub: user.id,
          role: user.role,
          agencyId: user.agencyId || null,
          exp
        });

        log(`LOGIN_SUCCESS ip=${ip} userId=${user.id} email=${email}`);
        return sendJson(res, 200, {
          token,
          user: sanitizeUser(user),
          expiresAt: new Date(exp * 1000).toISOString()
        });
      })
      .catch((error) => sendJson(res, 400, { error: error.message }));
  }

  if (pathname === '/api/auth/me' && req.method === 'GET') {
    const user = extractAuthUser(req);
    if (!user) {
      return sendJson(res, 401, { error: 'Non autorizzato' });
    }
    return sendJson(res, 200, { user });
  }

  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (token) {
      tokenBlacklist.add(token);
    }
    return sendJson(res, 200, { message: 'Logout effettuato' });
  }

  if (pathname === '/api/test-email' && req.method === 'POST') {
    const user = extractAuthUser(req);
    if (!isAllowedRole(user, ['operator', 'admin'])) {
      return sendJson(res, 403, { error: 'Ruolo non autorizzato' });
    }

    const transporter = getMailTransporter();
    if (!transporter) {
      return sendJson(res, 503, {
        ok: false,
        error: 'SMTP non configurato',
        config: {
          host: SMTP_HOST || '(vuoto)',
          port: SMTP_PORT,
          secure: SMTP_SECURE,
          user: SMTP_USER || '(vuoto)',
          passSet: Boolean(SMTP_PASS),
          notificationTo: BOOKING_NOTIFICATION_TO || '(vuoto)',
          notificationFrom: BOOKING_NOTIFICATION_FROM || '(vuoto)'
        }
      });
    }

    return transporter.verify()
      .then(() => transporter.sendMail({
        from: BOOKING_NOTIFICATION_FROM,
        to: BOOKING_NOTIFICATION_TO,
        subject: '[ITS] Test connessione email',
        text: `Test email inviata il ${nowIso()} da ${user.email} (${user.role})`
      }))
      .then((info) => sendJson(res, 200, { ok: true, messageId: info.messageId }))
      .catch((err) => sendJson(res, 500, { ok: false, error: err.message, code: err.code || null }));
  }

  if (pathname === '/api/bookings' && req.method === 'GET') {
    const user = extractAuthUser(req);
    if (!user) {
      return sendJson(res, 401, { error: 'Non autorizzato' });
    }

    const db = readDb();
    let bookings = db.bookings;
    if (user.role === 'agency') {
      bookings = bookings.filter((item) => item.agencyId === user.agencyId);
    }
    return sendJson(res, 200, {
      items: bookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    });
  }

  if (pathname === '/api/bookings' && req.method === 'POST') {
    const limit = checkRateLimit(req, 'booking', BOOKING_RATE_LIMIT_MAX, BOOKING_RATE_LIMIT_WINDOW_MS);
    if (!limit.allowed) {
      const retryAfterSec = Math.ceil(Math.max(limit.resetAt - Date.now(), 0) / 1000);
      return sendJson(res, 429, {
        error: 'Troppe richieste di prenotazione, riprova più tardi',
        retryAfterMs: Math.max(limit.resetAt - Date.now(), 0)
      }, { 'Retry-After': String(retryAfterSec) });
    }

    return parseRequestBody(req)
      .then((body) => {
        const authUser = extractAuthUser(req);
        const input = sanitizeBookingInput(body);
        const errors = validateBookingInput(input);
        if (errors.length) {
          return sendJson(res, 422, { error: 'Validazione fallita', details: errors });
        }

        const db = normalizeDb(readDb());
        const timestamp = nowIso();
        const reference = buildBookingReference(db.bookings);
        const creatorRole = authUser ? authUser.role : 'public';
        const creatorId = authUser ? authUser.id : 'public_web';
        const agencyId = authUser && authUser.role === 'agency'
          ? authUser.agencyId
          : (input.agencyId || null);

        const booking = {
          id: `bk_${Date.now()}`,
          reference,
          name: input.name,
          email: input.email,
          phone: input.phone || null,
          service: input.service,
          route: input.route,
          date: input.date,
          time: input.time || null,
          details: input.details || null,
          source: input.source || 'PUBLIC_WEB',
          status: 'PENDING_CONFIRMATION',
          agencyId,
          createdBy: {
            role: creatorRole,
            id: creatorId
          },
          createdAt: timestamp,
          updatedAt: timestamp,
          statusEvents: [
            {
              type: 'BOOKING_CREATED',
              at: timestamp,
              actorRole: creatorRole,
              actorId: creatorId,
              note: 'Booking inserito nel sistema'
            }
          ]
        };

        db.bookings.push(booking);
        writeDb(db);

        sendBookingNotificationEmail(booking)
          .then((emailResult) => {
            if (emailResult && emailResult.sent) {
              log(`Email booking inviata per ${booking.reference} a ${BOOKING_NOTIFICATION_TO}`);
            } else if (emailResult && emailResult.skipped) {
              log(`Email booking saltata per ${booking.reference}: ${emailResult.reason}`);
            }
          })
          .catch((error) => {
            log(`Invio email booking fallito per ${booking.reference}: ${error.message}`);
          });

        return sendJson(res, 201, {
          message: 'Prenotazione registrata',
          booking,
          notificationEmail: {
            queued: true
          }
        });
      })
      .catch((error) => sendJson(res, 400, { error: error.message }));
  }

  if (pathname === '/api/analytics-events' && req.method === 'POST') {
    const limit = checkRateLimit(req, 'analytics', ANALYTICS_RATE_LIMIT_MAX, ANALYTICS_RATE_LIMIT_WINDOW_MS);
    if (!limit.allowed) {
      const retryAfterSec = Math.ceil(Math.max(limit.resetAt - Date.now(), 0) / 1000);
      return sendJson(res, 429, {
        error: 'Troppi eventi analytics, riprova più tardi',
        retryAfterMs: Math.max(limit.resetAt - Date.now(), 0)
      }, { 'Retry-After': String(retryAfterSec) });
    }

    return parseRequestBody(req)
      .then((body) => {
        const input = sanitizeAnalyticsEvent(body);
        const errors = validateAnalyticsEvent(input);
        if (errors.length) {
          return sendJson(res, 422, { error: 'Validazione analytics fallita', details: errors });
        }

        const db = normalizeDb(readDb());
        const item = {
          id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          createdAt: nowIso(),
          event: input.event,
          sessionId: input.sessionId || null,
          lang: input.lang || null,
          deviceType: input.deviceType || null,
          pagePath: input.pagePath || null,
          pageTitle: input.pageTitle || null,
          source: input.source || null,
          label: input.label || null,
          href: input.href || null,
          formId: input.formId || null,
          errorType: input.errorType || null,
          errorMessage: input.errorMessage || null,
          missingFields: input.missingFields,
          funnelStep: input.funnelStep || null,
          utm: input.utm
        };

        db.analyticsEvents.push(item);
        writeDb(db);
        return sendJson(res, 201, { message: 'Evento analytics registrato', item });
      })
      .catch((error) => sendJson(res, 400, { error: error.message }));
  }

  if (pathname === '/api/analytics-events' && req.method === 'GET') {
    const user = extractAuthUser(req);
    if (!isAllowedRole(user, ['operator', 'admin'])) {
      return sendJson(res, 403, { error: 'Ruolo non autorizzato' });
    }

    const db = normalizeDb(readDb());
    return sendJson(res, 200, {
      items: db.analyticsEvents.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    });
  }

  if (pathname === '/api/analytics-events/export' && req.method === 'GET') {
    const user = extractAuthUser(req);
    if (!isAllowedRole(user, ['operator', 'admin'])) {
      return sendJson(res, 403, { error: 'Ruolo non autorizzato' });
    }

    const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const format = String(requestUrl.searchParams.get('format') || 'json').trim().toLowerCase();
    const db = normalizeDb(readDb());
    const items = db.analyticsEvents.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (format === 'csv') {
      return sendCsv(res, 'analytics-events.csv', serializeAnalyticsEventsCsv(items));
    }

    return sendJson(res, 200, { items });
  }

  if (pathname === '/api/insights/report' && req.method === 'GET') {
    const user = extractAuthUser(req);
    if (!isAllowedRole(user, ['operator', 'admin'])) {
      return sendJson(res, 403, { error: 'Ruolo non autorizzato' });
    }

    const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const db = normalizeDb(readDb());
    return sendJson(res, 200, {
      report: buildInsightsReport(db, {
        range: requestUrl.searchParams.get('range') || '30d',
        page: requestUrl.searchParams.get('page') || 'all'
      })
    });
  }

  if (pathname === '/api/analytics-snapshots' && req.method === 'GET') {
    const user = extractAuthUser(req);
    if (!isAllowedRole(user, ['operator', 'admin'])) {
      return sendJson(res, 403, { error: 'Ruolo non autorizzato' });
    }

    const db = normalizeDb(readDb());
    return sendJson(res, 200, {
      items: sortSnapshots(db.analyticsSnapshots)
    });
  }

  if (pathname === '/api/analytics-snapshots' && req.method === 'POST') {
    const user = extractAuthUser(req);
    if (!isAllowedRole(user, ['operator', 'admin'])) {
      return sendJson(res, 403, { error: 'Ruolo non autorizzato' });
    }

    return parseRequestBody(req)
      .then((body) => {
        const input = sanitizeAnalyticsSnapshot(body);
        const errors = validateAnalyticsSnapshot(input);
        if (errors.length) {
          return sendJson(res, 422, { error: 'Validazione snapshot fallita', details: errors });
        }

        const db = normalizeDb(readDb());
        db.analyticsSnapshots = db.analyticsSnapshots.filter((item) => item.id !== input.id);
        db.analyticsSnapshots.unshift(input);
        db.analyticsSnapshots = sortSnapshots(db.analyticsSnapshots).slice(0, 30);
        writeDb(db);
        return sendJson(res, 201, { message: 'Snapshot analytics salvato', item: input });
      })
      .catch((error) => sendJson(res, 400, { error: error.message }));
  }

  const snapshotMatch = pathname.match(/^\/api\/analytics-snapshots\/([^/]+)$/);
  if (snapshotMatch && req.method === 'DELETE') {
    const user = extractAuthUser(req);
    if (!isAllowedRole(user, ['operator', 'admin'])) {
      return sendJson(res, 403, { error: 'Ruolo non autorizzato' });
    }

    const snapshotId = snapshotMatch[1];
    const db = normalizeDb(readDb());
    const before = db.analyticsSnapshots.length;
    db.analyticsSnapshots = db.analyticsSnapshots.filter((item) => item.id !== snapshotId);
    if (db.analyticsSnapshots.length === before) {
      return sendJson(res, 404, { error: 'Snapshot non trovato' });
    }
    writeDb(db);
    return sendJson(res, 200, { message: 'Snapshot eliminato' });
  }

  const confirmMatch = pathname.match(/^\/api\/bookings\/([^/]+)\/confirm$/);
  if (confirmMatch && req.method === 'POST') {
    const user = extractAuthUser(req);
    if (!isAllowedRole(user, ['operator', 'admin'])) {
      return sendJson(res, 403, { error: 'Ruolo non autorizzato alla conferma' });
    }

    const bookingId = confirmMatch[1];
    return parseRequestBody(req)
      .then((body) => {
        const db = readDb();
        const booking = db.bookings.find((item) => item.id === bookingId);
        if (!booking) {
          return sendJson(res, 404, { error: 'Booking non trovato' });
        }

        const status = normalizeStatus(body.status) || 'CONFIRMED';
        const note = body.note ? String(body.note).trim() : null;
        const timestamp = nowIso();

        booking.status = status;
        booking.updatedAt = timestamp;
        booking.statusEvents.push({
          type: 'BOOKING_STATUS_CHANGED',
          at: timestamp,
          actorRole: user.role,
          actorId: user.id,
          note: note || `Stato impostato a ${status}`
        });

        writeDb(db);
        return sendJson(res, 200, {
          message: 'Stato booking aggiornato',
          booking
        });
      })
      .catch((error) => sendJson(res, 400, { error: error.message }));
  }

  return sendJson(res, 404, { error: 'Endpoint non trovato' });
}

function resolveStaticPath(pathname) {
  const cleaned = String(pathname || '').replace(/^\/+/, '').replace(/\/+$/, '');
  const requested = pathname === '/' ? 'index.html' : cleaned;
  const hasExtension = path.extname(requested).length > 0;
  const candidates = hasExtension
    ? [requested]
    : [requested, `${requested}.html`, path.join(requested, 'index.html')];

  for (const staticDir of STATIC_DIRS) {
    for (const candidate of candidates) {
      const normalized = path.normalize(candidate);
      const filePath = path.resolve(staticDir, normalized);
      const sourcePrefix = `${staticDir}${path.sep}`;
      if (filePath !== staticDir && !filePath.startsWith(sourcePrefix)) {
        continue;
      }

      const relativeToRoot = path.relative(ROOT_DIR, filePath);
      const pathParts = relativeToRoot.split(path.sep);
      const hasBlockedSegment = pathParts.some((part) => BLOCKED_STATIC_SEGMENTS.has(part));
      if (hasBlockedSegment) {
        continue;
      }

      if (
        path.dirname(filePath) === ROOT_DIR &&
        BLOCKED_ROOT_STATIC_FILES.has(path.basename(filePath))
      ) {
        continue;
      }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return filePath;
      }
    }
  }

  return null;
}

function serveStatic(req, res, pathname) {
  const filePath = resolveStaticPath(pathname);
  if (!filePath) {
    return sendText(res, 404, 'Not Found');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const headers = { ...getSecurityHeaders(), 'Content-Type': contentType };

  // Avoid stale homepage/content after deploys.
  if (ext === '.html') {
    headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, proxy-revalidate';
    headers.Pragma = 'no-cache';
    headers.Expires = '0';
  }

  res.writeHead(200, headers);
  fs.createReadStream(filePath).pipe(res);
}

function validateProductionConfig() {
  if (
    process.env.NODE_ENV === 'production' &&
    (AUTH_SECRET === 'its-beta-change-this-secret' || AUTH_SALT === 'its-beta-static-salt')
  ) {
    throw new Error('Configurazione insicura: imposta AUTH_SECRET e AUTH_SALT in produzione');
  }
}

function createAppServer() {
  return http.createServer((req, res) => {
    const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = requestUrl.pathname || '/';

    if (pathname.startsWith('/api/')) {
      return handleApi(req, res, pathname);
    }

    return serveStatic(req, res, pathname);
  });
}

function startServer(port = PORT) {
  ensureDb();
  validateProductionConfig();
  const server = createAppServer();
  let fallbackAttempted = false;

  server.on('error', (error) => {
    if (error && error.code === 'EADDRINUSE' && !fallbackAttempted) {
      fallbackAttempted = true;
      log(`Porta ${port} gia in uso. Avvio automatico su una porta libera...`);
      server.listen(0);
      return;
    }
    throw error;
  });

  server.listen(port, () => {
    const address = server.address();
    const activePort = typeof address === 'object' && address ? address.port : port;
    log(`Server avviato su http://localhost:${activePort}`);
  });
  return server;
}

if (require.main === module) {
  startServer(PORT);
}

module.exports = {
  startServer,
  createAppServer
};
