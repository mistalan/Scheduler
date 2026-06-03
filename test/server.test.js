const test = require('node:test');
const assert = require('node:assert/strict');
const createApp = require('../server');
const { createInitialState } = require('../src/state');

async function request(app, method, path, body) {
  const { default: supertest } = await import('supertest');
  const agent = supertest(app);
  const req = agent[method.toLowerCase()](path);
  if (body) req.send(body).set('Content-Type', 'application/json');
  return req;
}

test('POST /api/appointments creates an appointment and returns 201', async () => {
  const { app } = createApp();

  const response = await request(app, 'POST', '/api/appointments', {
    patientId: 'patient-felix',
    typeId: 'physiotherapy',
    therapistId: 'therapist-lenz',
    roomId: 'room-3-1',
    startAt: '2026-06-03T09:00:00.000Z',
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.appointment.patientId, 'patient-felix');
  assert.equal(response.body.appointment.typeName, 'Physiotherapy');
});

test('DELETE /api/appointments/:id cancels an appointment', async () => {
  const { app, state } = createApp();
  const appointmentId = state.appointments[0].id;

  const response = await request(app, 'DELETE', `/api/appointments/${appointmentId}`);
  assert.equal(response.status, 204);
  assert.equal(state.appointments[0].status, 'cancelled');
});

test('POST /api/patient-view returns 404 for invalid viewer key', async () => {
  const { app } = createApp();

  const response = await request(app, 'POST', '/api/patient-view', {
    viewerKey: 'invalid-key',
  });

  assert.equal(response.status, 404);
});
