const form = document.getElementById('blackspot-form');
const errorEl = document.getElementById('form-error');
const submitBtn = document.getElementById('submit-btn');
const useLocationBtn = document.getElementById('use-location');

useLocationBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    errorEl.textContent = 'Geolocation is not supported on this device/browser. Enter coordinates manually.';
    return;
  }
  useLocationBtn.disabled = true;
  useLocationBtn.textContent = 'Locating...';
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      document.getElementById('lat').value = pos.coords.latitude.toFixed(6);
      document.getElementById('lng').value = pos.coords.longitude.toFixed(6);
      useLocationBtn.disabled = false;
      useLocationBtn.textContent = 'Use my current location';
    },
    (err) => {
      errorEl.textContent = `Could not get location: ${err.message}. Enter coordinates manually.`;
      useLocationBtn.disabled = false;
      useLocationBtn.textContent = 'Use my current location';
    },
    { enableHighAccuracy: true, timeout: 15000 }
  );
});

function contactFrom(nameId, phoneId) {
  const name = document.getElementById(nameId).value.trim();
  const phone = document.getElementById(phoneId).value.trim();
  return phone ? { name, phone } : null;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.textContent = '';

  const lat = parseFloat(document.getElementById('lat').value);
  const lng = parseFloat(document.getElementById('lng').value);

  const payload = {
    locationName: document.getElementById('locationName').value.trim(),
    description: document.getElementById('description').value.trim(),
    lat,
    lng,
    police: contactFrom('police-name', 'police-phone'),
    hospital: contactFrom('hospital-name', 'hospital-phone'),
    ambulance: contactFrom('ambulance-name', 'ambulance-phone'),
  };

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    errorEl.textContent = 'Enter or fetch valid coordinates for the blackspot.';
    return;
  }
  if (!payload.police && !payload.hospital && !payload.ambulance) {
    errorEl.textContent = 'Add at least one contact (police, hospital, or ambulance).';
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Generating...';

  try {
    const res = await fetch('/api/blackspots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong');

    document.getElementById('qr-img').src = data.qrDataUrl;
    document.getElementById('qr-url').textContent = data.scanUrl;
    document.getElementById('download-link').href = data.qrDataUrl;
    document.getElementById('test-link').href = data.scanUrl;
    document.getElementById('result-card').style.display = 'block';
    form.style.display = 'none';
    document.getElementById('result-card').scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    errorEl.textContent = err.message;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Generate blackspot QR code';
  }
});
