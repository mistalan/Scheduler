async function fetchJson(url, options) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: 'Request failed.' }));
    throw new Error(payload.error || 'Request failed.');
  }

  return response.status === 204 ? null : response.json();
}

const state = {
  bootstrap: null,
  selectedPatientId: null,
};

function toLocalDateTime(isoValue) {
  return isoValue.slice(0, 16);
}

function renderOptions(select, items, selectedId, formatter = (item) => item.name) {
  select.innerHTML = items
    .map((item) => `<option value="${item.id}" ${item.id === selectedId ? 'selected' : ''}>${formatter(item)}</option>`)
    .join('');
}

function getSelectedAppointments() {
  return state.bootstrap.appointments.filter((appointment) => appointment.patientId === state.selectedPatientId);
}

function renderAppointments() {
  const host = document.querySelector('#appointments');
  const appointments = getSelectedAppointments();

  if (!appointments.length) {
    host.innerHTML = '<p>No appointments yet for this patient.</p>';
    return;
  }

  host.innerHTML = appointments
    .map(
      (appointment) => `
        <article class="card">
          <div class="card-header">
            <div>
              <h3>${appointment.typeName}</h3>
              <p>${new Date(appointment.startAt).toLocaleString()} · Floor ${appointment.floor}, room ${appointment.roomLabel}</p>
              <p>${appointment.therapistName} · ${appointment.status}</p>
            </div>
            <button class="button button-secondary cancel-button" data-id="${appointment.id}">Cancel</button>
          </div>
          <form class="inline-form update-form" data-id="${appointment.id}">
            <label>
              New start
              <input type="datetime-local" name="startAt" value="${toLocalDateTime(appointment.startAt)}" required />
            </label>
            <label>
              Therapist
              <select name="therapistId">
                ${state.bootstrap.therapists
                  .map(
                    (therapist) =>
                      `<option value="${therapist.id}" ${therapist.id === appointment.therapistId ? 'selected' : ''}>${therapist.name}</option>`,
                  )
                  .join('')}
              </select>
            </label>
            <label>
              Room
              <select name="roomId">
                ${state.bootstrap.rooms
                  .map(
                    (room) =>
                      `<option value="${room.id}" ${room.id === appointment.roomId ? 'selected' : ''}>${room.label}</option>`,
                  )
                  .join('')}
              </select>
            </label>
            <button class="button" type="submit">Update</button>
          </form>
        </article>
      `,
    )
    .join('');

  for (const form of host.querySelectorAll('.update-form')) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const appointmentId = form.dataset.id;
      const formData = new FormData(form);
      await updateAppointment(appointmentId, {
        patientId: state.selectedPatientId,
        typeId: state.bootstrap.appointments.find((appointment) => appointment.id === appointmentId).typeId,
        startAt: new Date(formData.get('startAt')).toISOString(),
        therapistId: formData.get('therapistId'),
        roomId: formData.get('roomId'),
      });
    });
  }

  for (const button of host.querySelectorAll('.cancel-button')) {
    button.addEventListener('click', async () => {
      await fetchJson(`/api/appointments/${button.dataset.id}`, { method: 'DELETE' });
      await refresh();
      showMessage('Appointment cancelled and patient notified.');
    });
  }
}

function showMessage(message, isError = false) {
  const host = document.querySelector('#admin-message');
  host.textContent = message;
  host.style.color = isError ? '#b64040' : '#1f5e8c';
}

async function refresh() {
  state.bootstrap = await fetchJson('/api/bootstrap');
  renderAppointments();
}

async function updateAppointment(appointmentId, payload) {
  try {
    await fetchJson(`/api/appointments/${appointmentId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    await refresh();
    showMessage('Appointment updated and patient notified.');
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function createAppointment(event) {
  event.preventDefault();
  const payload = {
    patientId: state.selectedPatientId,
    typeId: document.querySelector('#type-select').value,
    startAt: new Date(document.querySelector('#start-input').value).toISOString(),
    therapistId: document.querySelector('#therapist-select').value,
    roomId: document.querySelector('#room-select').value,
  };

  try {
    await fetchJson('/api/appointments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await refresh();
    showMessage('Appointment saved and pushed to the patient app.');
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function autoGeneratePlan() {
  try {
    await fetchJson(`/api/patients/${state.selectedPatientId}/plans/auto`, {
      method: 'POST',
      body: JSON.stringify({ day: document.querySelector('#day-input').value }),
    });
    await refresh();
    showMessage('Rehab day generated automatically.');
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function init() {
  state.bootstrap = await fetchJson('/api/bootstrap');
  state.selectedPatientId = state.bootstrap.patients[0].id;

  renderOptions(document.querySelector('#patient-select'), state.bootstrap.patients, state.selectedPatientId);
  renderOptions(document.querySelector('#type-select'), state.bootstrap.appointmentTypes, state.bootstrap.appointmentTypes[0].id);
  renderOptions(document.querySelector('#therapist-select'), state.bootstrap.therapists, state.bootstrap.therapists[0].id);
  renderOptions(document.querySelector('#room-select'), state.bootstrap.rooms, state.bootstrap.rooms[0].id, (room) => room.label);

  document.querySelector('#day-input').value = state.bootstrap.defaultDay;
  document.querySelector('#start-input').value = `${state.bootstrap.defaultDay}T09:00`;
  document.querySelector('#patient-select').addEventListener('change', (event) => {
    state.selectedPatientId = event.target.value;
    renderAppointments();
  });
  document.querySelector('#appointment-form').addEventListener('submit', createAppointment);
  document.querySelector('#auto-plan-button').addEventListener('click', autoGeneratePlan);

  renderAppointments();
}

init().catch((error) => showMessage(error.message, true));
