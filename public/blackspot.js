const id = window.location.pathname.split('/').pop();

const locationNameEl = document.getElementById('location-name');
const descriptionEl = document.getElementById('description');
const callButtonsEl = document.getElementById('call-buttons');
const alertBtn = document.getElementById('alert-btn');
const statusEl = document.getElementById('status');
const resultCard = document.getElementById('result-card');
const locationLine = document.getElementById('location-line');
const notifiedList = document.getElementById('notified-list');

let liveCoords = null;

const ROLE_LABEL = { police: 'Police', hospital: 'Hospital', ambulance: 'Ambulance' };

function renderCallButtons(blackspot) {
  const roles = ['police', 'hospital', 'ambulance'];
  const buttons = roles
    .filter((r) => blackspot[r] && blackspot[r].phone)
    .map((r) => {
      const c = blackspot[r];
      const label = c.name ? `${ROLE_LABEL[r]}: ${c.name}` : ROLE_LABEL[r];
      return `<a class="btn btn-primary call-btn" href="tel:${c.phone}">📞 Call ${label}</a>`;
    });
  callButtonsEl.innerHTML = buttons.join('') || '<p style="color:var(--muted);font-size:13px;">No contacts configured for this location yet.</p>';
}

async function loadBlackspot() {
  try {
    const res = await fetch(`/api/blackspots/${id}/public`);
    if (!res.ok) throw new Error('not found');
    const blackspot = await res.json();
    locationNameEl.textContent = blackspot.locationName;
    descriptionEl.textContent = blackspot.description || 'Registered accident blackspot';
    renderCallButtons(blackspot);
  } catch (err) {
    locationNameEl.textContent = 'Emergency Help';
    descriptionEl.textContent = 'This QR code is not registered.';
    alertBtn.disabled = true;
  }
}
loadBlackspot();

// Try to get a live, more precise GPS fix quietly in the background.
// Not required: the blackspot's own fixed coordinates are used as a
// fallback, so the alert works even without location permission.
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    (pos) => { liveCoords = pos.coords; },
    () => { /* ignore; fall back to the blackspot's registered location */ },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
  );
}

alertBtn.addEventListener('click', async () => {
  alertBtn.disabled = true;
  statusEl.className = 'status-line';
  statusEl.textContent = 'Sending alert...';

  try {
    const body = liveCoords
      ? { lat: liveCoords.latitude, lng: liveCoords.longitude, accuracy: liveCoords.accuracy }
      : {};

    const res = await fetch(`/api/blackspots/${id}/alert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to send alert');

    statusEl.className = 'status-line ok';
    statusEl.textContent = 'Alert sent!';
    renderResult(data);
  } catch (err) {
    statusEl.className = 'status-line err';
    statusEl.textContent = err.message;
    alertBtn.disabled = false;
  }
});

function statusTag(status) {
  const ok = ['sent', 'simulated', 'calling'].includes(status);
  return `<span class="tag ${ok ? '' : 'warn'}">${status}</span>`;
}

function renderResult(data) {
  resultCard.style.display = 'block';
  locationLine.innerHTML = `Shared location: <a href="${data.mapsUrl}" target="_blank">${data.mapsUrl}</a>`;
  notifiedList.innerHTML = data.notified
    .map(
      (n) => `<li><span>${ROLE_LABEL[n.role]}: ${n.name || n.phone}</span>
        <span>${statusTag(n.sms.status)} ${statusTag(n.call.status)}</span></li>`
    )
    .join('') || '<li>No contacts configured for this location</li>';
  resultCard.scrollIntoView({ behavior: 'smooth' });
}
