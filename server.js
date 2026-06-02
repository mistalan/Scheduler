const express = require('express');
const path = require('path');
const { createInitialState, serializeState } = require('./src/state');
const { buildPlan, createAppointmentId, validateAppointment } = require('./src/scheduler');

const app = express();
const state = createInitialState();
const patientStreams = new Map();

function getPatientSchedule(patientId) {
  return state.appointments
    .filter((appointment) => appointment.patientId === patientId)
    .sort((left, right) => new Date(left.startAt) - new Date(right.startAt));
}

function addNotification(patientId, message, details = {}) {
  const entry = {
    id: `notice-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    patientId,
    message,
    createdAt: new Date().toISOString(),
    details,
  };

  state.notifications[patientId] = [entry, ...(state.notifications[patientId] || [])].slice(0, 10);
  return entry;
}

function pushPatientUpdate(patientId, message, details = {}) {
  const notification = addNotification(patientId, message, details);
  const listeners = patientStreams.get(patientId);

  if (listeners) {
    const payload = JSON.stringify({
      type: 'schedule-updated',
      notification,
      appointments: getPatientSchedule(patientId),
    });

    for (const response of listeners) {
      response.write(`data: ${payload}\n\n`);
    }
  }

  return notification;
}

function sendValidationError(response, error, statusCode = 400) {
  response.status(statusCode).json({ error: error.message });
}

function isSameDay(appointment, day) {
  return appointment.startAt.startsWith(`${day}T`);
}

function getPatientByViewerKey(viewerKey) {
  return state.patients.find((patient) => patient.viewerKey === viewerKey);
}

function getPatientByStreamKey(streamKey) {
  return state.patients.find((patient) => patient.streamKey === streamKey);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/bootstrap', (_request, response) => {
  response.json(serializeState(state));
});

app.post('/api/patient-view', (request, response) => {
  const patient = getPatientByViewerKey(request.body.viewerKey);

  if (!patient) {
    return response.status(404).json({ error: 'Patient not found.' });
  }

  return response.json({
    patient,
    appointments: getPatientSchedule(patient.id),
    notifications: state.notifications[patient.id] || [],
  });
});

app.get('/api/patient-streams/:streamKey', (request, response) => {
  const patient = getPatientByStreamKey(request.params.streamKey);

  if (!patient) {
    return response.status(404).json({ error: 'Patient not found.' });
  }

  const patientId = patient.id;
  response.setHeader('Content-Type', 'text/event-stream');
  response.setHeader('Cache-Control', 'no-cache, no-transform');
  response.setHeader('Connection', 'keep-alive');
  response.flushHeaders();
  response.write(`data: ${JSON.stringify({ type: 'connected', patientId })}\n\n`);

  const listeners = patientStreams.get(patientId) || new Set();
  listeners.add(response);
  patientStreams.set(patientId, listeners);

  request.on('close', () => {
    listeners.delete(response);
    if (listeners.size === 0) {
      patientStreams.delete(patientId);
    }
  });
});

app.post('/api/patients/:patientId/plans/auto', (request, response) => {
  const patient = state.patients.find(({ id }) => id === request.params.patientId);

  if (!patient) {
    return response.status(404).json({ error: 'Patient not found.' });
  }

  try {
    const day = request.body.day || state.defaultDay;
    const typeIds = request.body.typeIds?.length
      ? request.body.typeIds
      : state.appointmentTypes.map(({ id }) => id);
    const replacedAppointments = state.appointments.filter(
      (appointment) =>
        appointment.patientId === patient.id &&
        appointment.status !== 'cancelled' &&
        isSameDay(appointment, day)
    );

    for (const appointment of replacedAppointments) {
      appointment.status = 'cancelled';
    }

    const createdAppointments = buildPlan({
      patientId: patient.id,
      day,
      typeIds,
      appointmentTypes: state.appointmentTypes,
      therapists: state.therapists,
      rooms: state.rooms,
      appointments: state.appointments,
      createAppointmentId,
    });

    state.appointments.push(...createdAppointments);
    pushPatientUpdate(
      patient.id,
      replacedAppointments.length
        ? 'Your rehab plan has been regenerated automatically.'
        : 'Your rehab plan has been generated automatically.',
      {
        changedAppointmentIds: createdAppointments.map(({ id }) => id),
        replacedAppointmentIds: replacedAppointments.map(({ id }) => id),
      }
    );

    return response.status(201).json({ appointments: createdAppointments });
  } catch (error) {
    return sendValidationError(response, error);
  }
});

app.post('/api/appointments', (request, response) => {
  try {
    const appointment = validateAppointment({
      input: request.body,
      state,
      createAppointmentId,
    });

    state.appointments.push(appointment);
    pushPatientUpdate(appointment.patientId, `${appointment.typeName} has been added to your plan.`, {
      changedAppointmentIds: [appointment.id],
    });

    return response.status(201).json({ appointment });
  } catch (error) {
    return sendValidationError(response, error);
  }
});

app.patch('/api/appointments/:appointmentId', (request, response) => {
  const index = state.appointments.findIndex(({ id }) => id === request.params.appointmentId);

  if (index === -1) {
    return response.status(404).json({ error: 'Appointment not found.' });
  }

  try {
    const current = state.appointments[index];
    const appointment = validateAppointment({
      input: { ...current, ...request.body, id: current.id },
      state,
      currentAppointmentId: current.id,
      createAppointmentId,
    });

    state.appointments[index] = appointment;
    pushPatientUpdate(appointment.patientId, `${appointment.typeName} has been updated.`, {
      changedAppointmentIds: [appointment.id],
    });

    return response.json({ appointment });
  } catch (error) {
    return sendValidationError(response, error);
  }
});

app.delete('/api/appointments/:appointmentId', (request, response) => {
  const appointment = state.appointments.find(({ id }) => id === request.params.appointmentId);

  if (!appointment) {
    return response.status(404).json({ error: 'Appointment not found.' });
  }

  appointment.status = 'cancelled';
  pushPatientUpdate(appointment.patientId, `${appointment.typeName} has been cancelled.`, {
    changedAppointmentIds: [appointment.id],
  });

  return response.status(204).end();
});

const port = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Scheduler app listening on http://localhost:${port}`);
  });
}

module.exports = app;
