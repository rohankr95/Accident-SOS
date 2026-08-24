const contactsEl = document.getElementById('contacts');
const addContactBtn = document.getElementById('add-contact');
const form = document.getElementById('profile-form');
const errorEl = document.getElementById('form-error');
const submitBtn = document.getElementById('submit-btn');

function addContactRow(name = '', phone = '') {
  const row = document.createElement('div');
  row.className = 'contact-row';
  row.innerHTML = `
    <input type="text" placeholder="Contact name" class="contact-name" value="${name}">
    <input type="tel" placeholder="Phone e.g. +919876543210" class="contact-phone" value="${phone}">
    <button type="button" title="Remove" class="remove-contact">&times;</button>
  `;
  row.querySelector('.remove-contact').addEventListener('click', () => {
    if (contactsEl.children.length > 1) row.remove();
  });
  contactsEl.appendChild(row);
}

addContactBtn.addEventListener('click', () => addContactRow());
addContactRow();

function collectContacts() {
  return [...contactsEl.querySelectorAll('.contact-row')]
    .map((row) => ({
      name: row.querySelector('.contact-name').value.trim(),
      phone: row.querySelector('.contact-phone').value.trim(),
    }))
    .filter((c) => c.phone);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.textContent = '';

  const payload = {
    name: document.getElementById('name').value.trim(),
    bloodGroup: document.getElementById('bloodGroup').value.trim(),
    medicalNotes: document.getElementById('medicalNotes').value.trim(),
    emergencyContacts: collectContacts(),
  };

  if (!payload.emergencyContacts.length) {
    errorEl.textContent = 'Add at least one emergency contact with a phone number.';
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Generating...';

  try {
    const res = await fetch('/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong');

    document.getElementById('qr-img').src = data.qrDataUrl;
    document.getElementById('qr-url').textContent = data.sosUrl;
    document.getElementById('download-link').href = data.qrDataUrl;
    document.getElementById('test-link').href = data.sosUrl;
    document.getElementById('result-card').style.display = 'block';
    form.style.display = 'none';
    document.getElementById('result-card').scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    errorEl.textContent = err.message;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Generate my QR code';
  }
});
