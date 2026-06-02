async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: 'Request failed.' }));
    throw new Error(payload.error || 'Request failed.');
  }

  return response.json();
}

const state = {
  bootstrap: null,
  selectedPatientId: null,
  stream: null,
};

function renderPatientOptions() {
  const selector = document.querySelector('#patient-selector');
  selector.innerHTML = state.bootstrap.patients
    .map((patient) => `<option value="${patient.id}">${patient.name}</option>`)
    .join('');
  selector.value = state.selectedPatientId;
}

function renderAppointments(appointments) {
  const host = document.querySelector('#patient-appointments');

  if (!appointments.length) {
    host.innerHTML = '<p>No appointments are scheduled yet.</p>';
    return;
  }

  host.innerHTML = appointments
    .map(
      (appointment) => `
        <article class="card">
          <h3>${appointment.typeName}</h3>
          <p>${new Date(appointment.startAt).toLocaleString()}</p>
          <p>Floor ${appointment.floor}, room ${appointment.roomLabel}</p>
          <p>${appointment.therapistName}</p>
        </article>
      `,
    )
    .join('');
}

function renderNotifications(notifications) {
  const host = document.querySelector('#patient-notifications');

  if (!notifications.length) {
    host.innerHTML = '<p>No notifications yet.</p>';
    return;
  }

  host.innerHTML = notifications
    .map(
      (notification) => `
        <article class="notification">
          <strong>${notification.message}</strong>
          <p>${new Date(notification.createdAt).toLocaleString()}</p>
        </article>
      `,
    )
    .join('');
}

async function loadPatient() {
  const payload = await fetchJson(`/api/patients/${state.selectedPatientId}`);
  renderAppointments(payload.appointments.filter((appointment) => appointment.status !== 'cancelled'));
  renderNotifications(payload.notifications);
}

function connectStream() {
  if (state.stream) {
    state.stream.close();
  }

  const status = document.querySelector('#connection-status');
  state.stream = new EventSource(`/api/patients/${state.selectedPatientId}/stream`);
  status.textContent = 'Live';
  status.classList.remove('pill-muted');

  state.stream.onmessage = async () => {
    await loadPatient();
  };

  state.stream.onerror = () => {
    status.textContent = 'Reconnecting…';
    status.classList.add('pill-muted');
  };
}

async function init() {
  state.bootstrap = await fetchJson('/api/bootstrap');
  state.selectedPatientId = state.bootstrap.patients[0].id;
  renderPatientOptions();
  await loadPatient();
  connectStream();

  document.querySelector('#patient-selector').addEventListener('change', async (event) => {
    state.selectedPatientId = event.target.value;
    await loadPatient();
    connectStream();
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

init().catch((error) => {
  document.querySelector('#patient-notifications').innerHTML = `<p>${error.message}</p>`;
});
