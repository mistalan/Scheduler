# Scheduler

Simple rehab scheduler with:

- an installable patient-facing web app for Android devices
- a lightweight admin web board for clinic staff
- automatic daily plan creation based on therapist and room availability
- live patient notifications through server-sent events when schedules change

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for a detailed technical overview.

## Run locally

```bash
npm install
npm start
```

Open:

- `http://localhost:3000/patient.html` for the patient app
- `http://localhost:3000/admin.html` for the admin board

## Test

```bash
npm test
```

## Deploy

### Server

The Express server binds to `PORT` (default `3000`) and is ready to run
behind a reverse proxy such as Kestrel, nginx, or Caddy:

```bash
# Direct
PORT=8080 node server.js

# With PM2
pm2 start server.js --name scheduler
```

### Patient app → APK

The patient web app is a TWA-ready PWA. To package it as an APK:

1. Host the app over HTTPS.
2. Use [Bubblewrap](https://github.com/nicokosi/nicokosi.github.io/blob/master/posts/2020-04-23-building-a-twa-with-bubblewrap.md)
   or [PWABuilder](https://www.pwabuilder.com/) to generate a Trusted Web Activity wrapper.
3. Sign and distribute the APK.
