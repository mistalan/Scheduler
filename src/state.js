function createInitialState() {
  return {
    defaultDay: '2026-06-03',
    patients: [
      { id: 'patient-anna', name: 'Anna Becker' },
      { id: 'patient-felix', name: 'Felix Novak' },
    ],
    appointmentTypes: [
      { id: 'medical-sports-training', name: 'Medical Sports Training', durationMinutes: 60 },
      { id: 'occupational-therapy', name: 'Occupational Therapy', durationMinutes: 60 },
      { id: 'seminar', name: 'Seminar', durationMinutes: 45 },
      { id: 'physiotherapy', name: 'Physiotherapy', durationMinutes: 60 },
      { id: 'therapeutic-cooking', name: 'Therapeutic Cooking', durationMinutes: 90 },
    ],
    therapists: [
      {
        id: 'therapist-lenz',
        name: 'Nina Lenz',
        specialties: ['physiotherapy', 'medical-sports-training'],
        availability: [
          { day: '2026-06-03', start: '08:00', end: '12:00' },
          { day: '2026-06-03', start: '13:00', end: '16:00' },
        ],
      },
      {
        id: 'therapist-otto',
        name: 'Marek Otto',
        specialties: ['occupational-therapy', 'therapeutic-cooking'],
        availability: [{ day: '2026-06-03', start: '09:00', end: '16:00' }],
      },
      {
        id: 'therapist-rau',
        name: 'Clara Rau',
        specialties: ['seminar'],
        availability: [{ day: '2026-06-03', start: '10:00', end: '16:00' }],
      },
    ],
    rooms: [
      {
        id: 'room-3-1',
        label: '3.1',
        floor: 3,
        supports: ['physiotherapy', 'medical-sports-training'],
        availability: [{ day: '2026-06-03', start: '08:00', end: '16:00' }],
      },
      {
        id: 'room-2-4',
        label: '2.4',
        floor: 2,
        supports: ['occupational-therapy', 'seminar'],
        availability: [{ day: '2026-06-03', start: '09:00', end: '16:00' }],
      },
      {
        id: 'room-1-0',
        label: '1.0',
        floor: 1,
        supports: ['therapeutic-cooking'],
        availability: [{ day: '2026-06-03', start: '10:00', end: '16:00' }],
      },
    ],
    appointments: [
      {
        id: 'appointment-101',
        patientId: 'patient-anna',
        typeId: 'physiotherapy',
        typeName: 'Physiotherapy',
        therapistId: 'therapist-lenz',
        therapistName: 'Nina Lenz',
        roomId: 'room-3-1',
        roomLabel: '3.1',
        floor: 3,
        startAt: '2026-06-03T08:00:00.000Z',
        durationMinutes: 60,
        status: 'scheduled',
      },
    ],
    notifications: {
      'patient-anna': [
        {
          id: 'notice-seed-1',
          patientId: 'patient-anna',
          message: 'Welcome back. Your 08:00 physiotherapy session is confirmed.',
          createdAt: '2026-06-02T20:00:00.000Z',
          details: {},
        },
      ],
      'patient-felix': [],
    },
  };
}

function serializeState(state) {
  return {
    defaultDay: state.defaultDay,
    patients: state.patients,
    appointmentTypes: state.appointmentTypes,
    therapists: state.therapists,
    rooms: state.rooms,
    appointments: [...state.appointments].sort((left, right) => new Date(left.startAt) - new Date(right.startAt)),
  };
}

module.exports = {
  createInitialState,
  serializeState,
};
