const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
  '.woff2': 'font/woff2'
};

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function nowIso() {
  return new Date().toISOString();
}

const rateLimitStore = new Map();

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

    users.push({
      id: config.id,
      name: config.name,
      email: config.email,
      role: config.role,
      agencyId: config.agencyId || null,
      passwordHash: hashPassword(config.password)
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
      analyticsEvents: []
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
      analyticsEvents: Array.isArray(existing.analyticsEvents) ? existing.analyticsEvents : []
    };

    const needsWrite = !Array.isArray(existing.analyticsEvents) || !Array.isArray(existing.bookings) || !Array.isArray(existing.users);
    if (needsWrite) {
      fs.writeFileSync(DB_PATH, JSON.stringify(normalized, null, 2), 'utf8');
    }

    if (hasUsers) {
      return;
    }

    const merged = {
      users: bootstrapUsers,
      bookings: normalized.bookings,
      analyticsEvents: normalized.analyticsEvents
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
    analyticsEvents: Array.isArray(db.analyticsEvents) ? db.analyticsEvents : []
  };
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function sendText(res, statusCode, body) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function sendCsv(res, filename, body) {
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
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
      return sendJson(res, 429, {
        error: 'Troppi tentativi login, riprova più tardi',
        retryAfterMs: Math.max(limit.resetAt - Date.now(), 0)
      });
    }

    return parseRequestBody(req)
      .then((body) => {
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');
        const db = readDb();
        const user = db.users.find((item) => item.email.toLowerCase() === email);
        if (!user || user.passwordHash !== hashPassword(password)) {
          return sendJson(res, 401, { error: 'Credenziali non valide' });
        }

        const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 8;
        const token = signToken({
          sub: user.id,
          role: user.role,
          agencyId: user.agencyId || null,
          exp
        });

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
      return sendJson(res, 429, {
        error: 'Troppe richieste di prenotazione, riprova più tardi',
        retryAfterMs: Math.max(limit.resetAt - Date.now(), 0)
      });
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

        return sendJson(res, 201, {
          message: 'Prenotazione registrata',
          booking
        });
      })
      .catch((error) => sendJson(res, 400, { error: error.message }));
  }

  if (pathname === '/api/analytics-events' && req.method === 'POST') {
    const limit = checkRateLimit(req, 'analytics', ANALYTICS_RATE_LIMIT_MAX, ANALYTICS_RATE_LIMIT_WINDOW_MS);
    if (!limit.allowed) {
      return sendJson(res, 429, {
        error: 'Troppi eventi analytics, riprova più tardi',
        retryAfterMs: Math.max(limit.resetAt - Date.now(), 0)
      });
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
  const headers = { 'Content-Type': contentType };

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
