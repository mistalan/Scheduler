const express = require('express');
const path = require('path');
const { createInitialState, serializeState } = require('./src/state');
const { buildPlan, createAppointmentId, validateAppointment } = require('./src/scheduler');
const { mountRoutes } = require('./src/routes');

function createApp(initialState) {
  const app = express();
  const state = initialState || createInitialState();
  const patientStreams = new Map();

  app.set('trust proxy', true);

  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  mountRoutes(app, {
    state,
    patientStreams,
    serializeState,
    buildPlan,
    createAppointmentId,
    validateAppointment,
  });

  return { app, state };
}

const port = process.env.PORT || 3000;

if (require.main === module) {
  const { app } = createApp();

  const server = app.listen(port, () => {
    console.log(`Scheduler app listening on http://localhost:${port}`);
  });

  function shutdown() {
    console.log('Shutting down gracefully…');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000);
  }

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

module.exports = createApp;
