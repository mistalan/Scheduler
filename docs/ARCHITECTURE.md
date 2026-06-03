# Architecture

## Purpose

A clinical rehab scheduler that lets clinic staff manage daily therapy plans
for patients and pushes every change to the patient's device in real time.
Patients install the app on their own phones or tablets from Google Play
(reached via a QR code handed out at admission) and activate it with a
one-time code printed on paper. The admin side is a lightweight board used
by reception or therapy coordinators.

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Runtime | **Node.js 20+** | Single-language stack keeps the project small; the built-in `node:test` runner removes the need for external test frameworks. |
| HTTP framework | **Express 5** | Minimal surface area for a REST + SSE server; v5 improves async error handling over v4. |
| Client app | **Vanilla JS + PWA** | No build step, no bundler, no framework dependency — patients install the app on their own Android phones/tablets via Google Play. A vanilla stack keeps the TWA wrapper thin and avoids native toolchain requirements. |
| Real-time channel | **Server-Sent Events (SSE)** | One-directional push from server to patient is sufficient; SSE is natively supported by every modern browser and reconnects automatically, unlike WebSockets which add bidirectional complexity that is not needed here. |
| Packaging (Android) | **Trusted Web Activity (TWA) via Bubblewrap** | Wraps the PWA in a thin Android shell for distribution through Google Play, so patients can install it like any regular app from a QR code link. No Kotlin/Java rewrite required; the manifest and service worker make the app TWA-eligible. |
| Hosting | **Any Node.js-capable host (PM2, systemd, Docker, or behind a reverse proxy such as Kestrel, nginx, or Caddy)** | Express binds to a single port; a reverse proxy in front handles TLS termination, compression, and process supervision. |

---

## Key Patterns

### In-memory state with seed data

All patients, therapists, rooms, appointment types, and appointments live in
a single `state` object created at startup (`src/state.js`).

**Why:** The prototype intentionally avoids a database so it can be demo'd
with `npm start` and zero configuration. The state module is the only place
that would need to change when a persistence layer is introduced — every
consumer reads and writes through it already.

### Greedy slot scheduler

`buildPlan` in `src/scheduler.js` walks the requested therapy types in order,
finds the earliest available 30-minute-aligned slot that satisfies therapist
specialty, room capability, and existing booking constraints, then advances
the cursor so the next therapy starts after the previous one ends.

**Why:** A greedy first-fit approach produces a compact, gap-free daily plan
that is easy for patients to follow. More sophisticated solvers
(constraint programming, backtracking) are unnecessary when daily plans
contain fewer than ten appointments and three therapists.

### Push-on-write via SSE

Every write endpoint (`POST`, `PATCH`, `DELETE` on appointments) calls
`pushPatientUpdate`, which fans the change out to all open SSE connections
for the affected patient.

**Why:** Patients must see schedule changes immediately — a cancelled
physiotherapy session should appear on the patient's screen within seconds,
not after a manual refresh. SSE achieves this with minimal code and no
external message broker.

### PWA with app-shell caching

The service worker pre-caches the HTML, CSS, and JS shell at install time.
API requests bypass the cache entirely to guarantee fresh data on every load.

**Why:** Clinic Wi-Fi can be unreliable; caching the shell lets the app
open instantly even on a flaky connection, while API data is always
authoritative from the server.

### One-time code onboarding

Patients receive a printed QR code at admission that links to the app in
Google Play. After installing, they enter a one-time code (also on the
printout) to pair the app with their patient record. This replaces full
authentication while keeping the onboarding frictionless for non-technical
users.

### Viewer key / stream key separation

Each patient has two opaque tokens: a `viewerKey` for fetching their
schedule and a `streamKey` for opening an SSE connection.

**Why:** Separating read credentials from the streaming endpoint allows
the SSE URL to be stable without exposing the data-fetch token in the
EventSource URL, providing an access-control boundary that complements the
one-time code registration.

---

## Project Layout

```
server.js              → Express app: routes, SSE fan-out, validation
src/
  scheduler.js         → Slot-finding and plan-building logic (pure functions)
  state.js             → Seed data factory and serialisation
public/
  index.html           → Landing page
  patient.html / .js   → Patient-facing installable app
  admin.html / .js     → Staff admin board
  styles.css           → Shared stylesheet
  sw.js                → Service worker (app-shell cache)
  manifest.webmanifest → PWA manifest (TWA-ready)
  icons/               → PWA icons (192 × 192, 512 × 512)
test/
  scheduler.test.js    → Unit tests for scheduling logic
docs/
  ARCHITECTURE.md      → This file
```

---

## Deployment

### Patient app → APK

1. Serve the app over HTTPS (required for TWA).
2. Use [Bubblewrap](https://github.com/nicokosi/nicokosi.github.io/blob/master/posts/2020-04-23-building-a-twa-with-bubblewrap.md) or [PWABuilder](https://www.pwabuilder.com/) to
   generate a TWA wrapper that points to the hosted PWA URL.
3. Sign the APK and publish to Google Play.
4. Generate a QR code linking to the Play Store listing — print it on
   the patient's admission sheet alongside their one-time activation code.

### Server → production host

```bash
# Direct
PORT=8080 node server.js

# With PM2
pm2 start server.js --name scheduler

# Behind Kestrel (.NET reverse proxy)
# Configure Kestrel to forward to http://localhost:3000

# Docker
docker build -t scheduler .
docker run -p 3000:3000 scheduler
```

The server reads `PORT` from the environment (default `3000`) and sets
`trust proxy` so `X-Forwarded-*` headers from a reverse proxy are honoured.
