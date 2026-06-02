const SLOT_INCREMENT_MINUTES = 30;

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000);
}

function combineDayAndTime(day, time) {
  return new Date(`${day}T${time}:00`);
}

function overlaps(startAt, durationMinutes, otherStartAt, otherDurationMinutes) {
  const start = new Date(startAt);
  const end = addMinutes(start, durationMinutes);
  const otherStart = new Date(otherStartAt);
  const otherEnd = addMinutes(otherStart, otherDurationMinutes);
  return start < otherEnd && otherStart < end;
}

function getAppointmentType(appointmentTypes, typeId) {
  const type = appointmentTypes.find((entry) => entry.id === typeId);

  if (!type) {
    throw new Error(`Unknown appointment type: ${typeId}`);
  }

  return type;
}

function getEntity(items, id, label) {
  const item = items.find((entry) => entry.id === id);

  if (!item) {
    throw new Error(`${label} not found.`);
  }

  return item;
}

function isWindowAvailable(windows, startAt, durationMinutes) {
  const endAt = addMinutes(startAt, durationMinutes);
  return windows.some((window) => {
    const windowStart = combineDayAndTime(window.day, window.start);
    const windowEnd = combineDayAndTime(window.day, window.end);
    return startAt >= windowStart && endAt <= windowEnd;
  });
}

function isSlotFree(appointments, slot) {
  return appointments
    .filter((appointment) => appointment.status !== 'cancelled' && appointment.id !== slot.ignoreAppointmentId)
    .every((appointment) => {
      if (!overlaps(slot.startAt, slot.durationMinutes, appointment.startAt, appointment.durationMinutes)) {
        return true;
      }

      return (
        appointment.patientId !== slot.patientId &&
        appointment.therapistId !== slot.therapistId &&
        appointment.roomId !== slot.roomId
      );
    });
}

function findEarliestSlot({
  patientId,
  type,
  day,
  therapists,
  rooms,
  appointments,
  notBefore,
}) {
  const therapistCandidates = therapists.filter((therapist) => therapist.specialties.includes(type.id));
  const roomCandidates = rooms.filter((room) => room.supports.includes(type.id));
  let earliestSlot = null;

  for (const therapist of therapistCandidates) {
    for (const window of therapist.availability.filter((entry) => entry.day === day)) {
      const windowStart = combineDayAndTime(day, window.start);
      const windowEnd = combineDayAndTime(day, window.end);
      const slotStart = new Date(Math.max(windowStart.getTime(), notBefore.getTime()));

      for (
        let startAt = slotStart;
        addMinutes(startAt, type.durationMinutes) <= windowEnd;
        startAt = addMinutes(startAt, SLOT_INCREMENT_MINUTES)
      ) {
        for (const room of roomCandidates) {
          if (!isWindowAvailable(room.availability, startAt, type.durationMinutes)) {
            continue;
          }

          const slot = {
            patientId,
            therapistId: therapist.id,
            roomId: room.id,
            startAt: startAt.toISOString(),
            durationMinutes: type.durationMinutes,
          };

          if (!isSlotFree(appointments, slot)) {
            continue;
          }

          if (!earliestSlot || new Date(slot.startAt) < new Date(earliestSlot.startAt)) {
            earliestSlot = slot;
          }
        }
      }
    }
  }

  if (!earliestSlot) {
    throw new Error(`No available slot found for ${type.name} on ${day}.`);
  }

  return earliestSlot;
}

function buildPlan({
  patientId,
  day,
  typeIds,
  appointmentTypes,
  therapists,
  rooms,
  appointments,
  createAppointmentId,
}) {
  const nextAppointments = [...appointments];
  const createdAppointments = [];
  let nextStart = combineDayAndTime(day, '08:00');

  for (const typeId of typeIds) {
    const type = getAppointmentType(appointmentTypes, typeId);
    const slot = findEarliestSlot({
      patientId,
      type,
      day,
      therapists,
      rooms,
      appointments: nextAppointments,
      notBefore: nextStart,
    });
    const therapist = getEntity(therapists, slot.therapistId, 'Therapist');
    const room = getEntity(rooms, slot.roomId, 'Room');
    const appointment = {
      id: createAppointmentId(),
      patientId,
      typeId: type.id,
      typeName: type.name,
      therapistId: therapist.id,
      therapistName: therapist.name,
      roomId: room.id,
      roomLabel: room.label,
      floor: room.floor,
      startAt: slot.startAt,
      durationMinutes: type.durationMinutes,
      status: 'scheduled',
    };

    createdAppointments.push(appointment);
    nextAppointments.push(appointment);
    nextStart = addMinutes(new Date(appointment.startAt), appointment.durationMinutes);
  }

  return createdAppointments;
}

function validateAppointment({
  input,
  state,
  currentAppointmentId,
  createAppointmentId,
}) {
  const patient = getEntity(state.patients, input.patientId, 'Patient');
  const type = getAppointmentType(state.appointmentTypes, input.typeId);
  const therapist = getEntity(state.therapists, input.therapistId, 'Therapist');
  const room = getEntity(state.rooms, input.roomId, 'Room');
  const startAt = new Date(input.startAt);

  if (Number.isNaN(startAt.getTime())) {
    throw new Error('A valid appointment time is required.');
  }

  if (!therapist.specialties.includes(type.id)) {
    throw new Error(`${therapist.name} cannot deliver ${type.name}.`);
  }

  if (!room.supports.includes(type.id)) {
    throw new Error(`${room.label} is not configured for ${type.name}.`);
  }

  if (!isWindowAvailable(therapist.availability, startAt, type.durationMinutes)) {
    throw new Error(`${therapist.name} is not available at the selected time.`);
  }

  if (!isWindowAvailable(room.availability, startAt, type.durationMinutes)) {
    throw new Error(`${room.label} is not available at the selected time.`);
  }

  const appointment = {
    id: input.id || createAppointmentId(),
    patientId: patient.id,
    typeId: type.id,
    typeName: type.name,
    therapistId: therapist.id,
    therapistName: therapist.name,
    roomId: room.id,
    roomLabel: room.label,
    floor: room.floor,
    startAt: startAt.toISOString(),
    durationMinutes: type.durationMinutes,
    status: input.status || 'scheduled',
  };

  const isValid = isSlotFree(state.appointments, {
    ...appointment,
    ignoreAppointmentId: currentAppointmentId,
  });

  if (!isValid) {
    throw new Error('The selected patient, therapist, or room is already booked for this slot.');
  }

  return appointment;
}

let appointmentSequence = 200;

function createAppointmentId() {
  appointmentSequence += 1;
  return `appointment-${appointmentSequence}`;
}

module.exports = {
  buildPlan,
  combineDayAndTime,
  createAppointmentId,
  findEarliestSlot,
  overlaps,
  validateAppointment,
};
