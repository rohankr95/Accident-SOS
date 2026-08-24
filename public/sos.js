const id = window.location.pathname.split('/').pop();

const nameEl = document.getElementById('profile-name');
const metaEl = document.getElementById('profile-meta');
const sosBtn = document.getElementById('sos-btn');
const cancelBtn = document.getElementById('cancel-btn');
const countdownText = document.getElementById('countdown-text');
const statusEl = document.getElementById('status');
const resultCard = document.getElementById('result-card');
const locationLine = document.getElementById('location-line');
const contactsList = document.getElementById('contacts-list');
const servicesList = document.getElementById('services-list');

const AUTO_TRIGGER_SECONDS = 5;
let countdownTimer = null;

async function loadProfile() {
  try {
    const res = await fetch(`/api/profiles/${id}/public`);
    if (!res.ok) throw new Error('Profile not found');
    const profile = await res.json();
    nameEl.textContent = profile.name;
    metaEl.textContent = profile.bloodGroup ? `Blood group: ${profile.bloodGroup}` : 'Tap SEND SOS if this person needs help';
  } catch (err) {
    nameEl.textContent = 'Emergency Alert';
    metaEl.textContent = 'This QR code is not registered.';
    sosBtn.disabled = true;
  }
}
loadProfile();

sosBtn.addEventListener('click', startCountdown);
cancelBtn.addEventListener('click', cancelCountdown);

function startCountdown() {
  sosBtn.style.display = 'none';
  cancelBtn.style.display = 'inline-flex';
  countdownText.style.display = 'block';
  let remaining = AUTO_TRIGGER_SECONDS;
  countdownText.textContent = `Sending alert in ${remaining}... tap Cancel to stop`;
  countdownTimer = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(countdownTimer);
      countdownTimer = null;
      countdownText.style.display = 'none';
      cancelBtn.style.display = 'none';
      triggerAlert();
    } else {
      countdownText.textContent = `Sending alert in ${remaining}... tap Cancel to stop`;
    }
  }, 1000);
}

function cancelCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = null;
  countdownText.style.display = 'none';
  cancelBtn.style.display = 'none';
  sosBtn.style.display = 'flex';
  statusEl.textContent = '';
}

function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported on this device/browser'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      (err) => reject(new Error(`Location permission needed: ${err.message}`)),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

async function triggerAlert() {
  statusEl.className = 'status-line';
  statusEl.textContent = 'Getting your location...';
  try {
    const coords = await getLocation();
    statusEl.textContent = 'Location found. Sending alerts...';

    const res = await fetch(`/api/sos/${id}/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to send alert');

    statusEl.className = 'status-line ok';
    statusEl.textContent = 'Alert sent!';
    renderResult(data);
  } catch (err) {
    statusEl.className = 'status-line err';
    statusEl.textContent = err.message;
    sosBtn.style.display = 'flex';
    sosBtn.textContent = 'TRY AGAIN';
  }
}

function statusTag(status) {
  const ok = ['sent', 'simulated', 'calling'].includes(status);
  return `<span class="tag ${ok ? '' : 'warn'}">${status}</span>`;
}

function renderResult(data) {
  resultCard.style.display = 'block';
  locationLine.innerHTML = `Shared location: <a href="${data.mapsUrl}" target="_blank">${data.mapsUrl}</a>`;

  contactsList.innerHTML = data.contactsNotified
    .map((c) => `<li><span>${c.contactName || c.to}</span>${statusTag(c.status)}</li>`)
    .join('') || '<li>No contacts on file</li>';

  const svc = [];
  if (data.nearestServices.hospital) {
    const h = data.nearestServices.hospital;
    svc.push(`<li><span>Hospital: ${h.name} (${(h.distanceMeters / 1000).toFixed(1)} km)</span>${statusTag(h.notification.status)}</li>`);
  }
  if (data.nearestServices.police) {
    const p = data.nearestServices.police;
    svc.push(`<li><span>Police: ${p.name} (${(p.distanceMeters / 1000).toFixed(1)} km)</span>${statusTag(p.notification.status)}</li>`);
  }
  servicesList.innerHTML = svc.join('') || '<li>No nearby services found in range</li>';

  resultCard.scrollIntoView({ behavior: 'smooth' });
}
