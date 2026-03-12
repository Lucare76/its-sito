const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const url = require('url');

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
const SRC_DIR = path.join(ROOT_DIR, 'src');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

const PORT = Number(process.env.PORT || 4000);
const AUTH_SECRET = process.env.AUTH_SECRET || 'its-beta-change-this-secret';
const AUTH_SALT = process.env.AUTH_SALT || 'its-beta-static-salt';
const BOOKING_RATE_LIMIT_MAX = Number(process.env.BOOKING_RATE_LIMIT_MAX || 20);
const BOOKING_RATE_LIMIT_WINDOW_MS = Number(process.env.BOOKING_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const LOGIN_RATE_LIMIT_MAX = Number(process.env.LOGIN_RATE_LIMIT_MAX || 25);
const LOGIN_RATE_LIMIT_WINDOW_MS = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);

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

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_PATH)) {
    const seed = {
      users: [
        {
          id: 'usr_operator_1',
          name: 'Operatore ITS',
          email: 'operator@its.local',
          role: 'operator',
          agencyId: null,
          passwordHash: hashPassword('operator123')
        },
        {
          id: 'usr_admin_1',
          name: 'Admin ITS',
          email: 'admin@its.local',
          role: 'admin',
          agencyId: null,
          passwordHash: hashPassword('admin123')
        },
        {
          id: 'usr_agency_1',
          name: 'Agenzia Demo',
          email: 'agency.demo@its.local',
          role: 'agency',
          agencyId: 'agency_demo',
          passwordHash: hashPassword('agency123')
        }
      ],
      bookings: []
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(seed, null, 2), 'utf8');
    log('DB inizializzato con utenti demo in data/db.json');
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

        const db = readDb();
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

  for (const candidate of candidates) {
    const normalized = path.normalize(candidate);
    const filePath = path.resolve(SRC_DIR, normalized);
    const sourcePrefix = `${SRC_DIR}${path.sep}`;
    if (filePath !== SRC_DIR && !filePath.startsWith(sourcePrefix)) {
      continue;
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return filePath;
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
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname || '/';

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
  server.listen(port, () => {
    log(`Server avviato su http://localhost:${port}`);
    log('Demo login operator: operator@its.local / operator123');
    log('Demo login agency: agency.demo@its.local / agency123');
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
