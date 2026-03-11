# I.T.S. Ischia Transfer Service S.r.l.

Beta foundation for a modern Ischia Transfer Service website with a minimal operational backend:
- public website in `src/`
- API for authentication and booking flow
- JSON persistence in `data/db.json`

## Project Structure

```
its-sito
├── src/
│   ├── index.html
│   ├── assets/
│   ├── scripts/main.js
│   └── styles/
├── server.js
├── data/db.json           # created automatically at first start
├── tailwind.config.js
├── package.json
└── .env.example
```

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Optional env file:
   ```bash
   copy .env.example .env
   ```
3. Build CSS:
   ```bash
   npm run build
   ```
4. Start app (website + API):
   ```bash
   npm start
   ```
5. Run smoke test:
   ```bash
   npm test
   ```
6. Open:
   - Website: `http://localhost:4000`
   - Health: `http://localhost:4000/api/health`
   - Ops dashboard: `http://localhost:4000/ops.html`

## API (beta)

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/bookings`
- `GET /api/bookings` (auth required)
- `POST /api/bookings/:id/confirm` (role `operator` or `admin`)

## Security Notes

- Set `.env` from `.env.example` before deployment.
- In `NODE_ENV=production`, server startup fails if default auth secrets are still used.

## Demo Credentials

- Operator: `operator@its.local` / `operator123`
- Admin: `admin@its.local` / `admin123`
- Agency: `agency.demo@its.local` / `agency123`
