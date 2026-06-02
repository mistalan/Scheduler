const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPlan, findEarliestSlot, validateAppointment } = require('../src/scheduler');
const { createInitialState } = require('../src/state');

test('findEarliestSlot skips over conflicting therapist and room bookings', () => {
  const state = createInitialState();
  const type = state.appointmentTypes.find((entry) => entry.id === 'medical-sports-training');

  const slot = findEarliestSlot({
    patientId: 'patient-felix',
    type,
    day: state.defaultDay,
    therapists: state.therapists,
    rooms: state.rooms,
    appointments: state.appointments,
    notBefore: new Date(`${state.defaultDay}T08:00:00`),
  });

  assert.equal(slot.startAt, '2026-06-03T09:00:00.000Z');
  assert.equal(slot.therapistId, 'therapist-lenz');
  assert.equal(slot.roomId, 'room-3-1');
});

test('buildPlan creates a sequential rehab day without overlaps', () => {
  const state = createInitialState();
  let sequence = 300;

  const plan = buildPlan({
    patientId: 'patient-felix',
    day: state.defaultDay,
    typeIds: ['medical-sports-training', 'occupational-therapy', 'seminar'],
    appointmentTypes: state.appointmentTypes,
    therapists: state.therapists,
    rooms: state.rooms,
    appointments: state.appointments,
    createAppointmentId: () => `appointment-${++sequence}`,
  });

  assert.deepEqual(
    plan.map((appointment) => [appointment.typeId, appointment.startAt]),
    [
      ['medical-sports-training', '2026-06-03T09:00:00.000Z'],
      ['occupational-therapy', '2026-06-03T10:00:00.000Z'],
      ['seminar', '2026-06-03T11:00:00.000Z'],
    ],
  );
});

test('buildPlan can generate the full default therapy plan', () => {
  const state = createInitialState();
  let sequence = 400;

  const plan = buildPlan({
    patientId: 'patient-felix',
    day: state.defaultDay,
    typeIds: state.appointmentTypes.map((type) => type.id),
    appointmentTypes: state.appointmentTypes,
    therapists: state.therapists,
    rooms: state.rooms,
    appointments: state.appointments,
    createAppointmentId: () => `appointment-${++sequence}`,
  });

  assert.deepEqual(
    plan.map((appointment) => [appointment.typeId, appointment.startAt]),
    [
      ['medical-sports-training', '2026-06-03T09:00:00.000Z'],
      ['occupational-therapy', '2026-06-03T10:00:00.000Z'],
      ['seminar', '2026-06-03T11:00:00.000Z'],
      ['physiotherapy', '2026-06-03T13:00:00.000Z'],
      ['therapeutic-cooking', '2026-06-03T14:00:00.000Z'],
    ],
  );
});

test('validateAppointment rejects overlapping bookings for the same room', () => {
  const state = createInitialState();

  assert.throws(
    () =>
      validateAppointment({
        input: {
          patientId: 'patient-felix',
          typeId: 'medical-sports-training',
          therapistId: 'therapist-lenz',
          roomId: 'room-3-1',
          startAt: '2026-06-03T08:00:00.000Z',
        },
        state,
        createAppointmentId: () => 'appointment-test',
      }),
    /already booked/,
  );
});
