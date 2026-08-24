const express = require('express');
const { nanoid } = require('nanoid');
const QRCode = require('qrcode');
const { transact, load } = require('../db');

const router = express.Router();

function getBaseUrl(req) {
  return process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
}

function validateContacts(contacts) {
  if (!Array.isArray(contacts) || contacts.length === 0) return 'At least one emergency contact is required';
  for (const c of contacts) {
    if (!c || typeof c.phone !== 'string' || !c.phone.trim()) {
      return 'Every emergency contact needs a phone number';
    }
  }
  return null;
}

// Create a new emergency profile and its QR code.
router.post('/', async (req, res) => {
  const { name, bloodGroup, medicalNotes, emergencyContacts } = req.body || {};

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  const contactError = validateContacts(emergencyContacts);
  if (contactError) return res.status(400).json({ error: contactError });

  const id = nanoid(10);
  const profile = {
    id,
    name: name.trim(),
    bloodGroup: (bloodGroup || '').trim(),
    medicalNotes: (medicalNotes || '').trim(),
    emergencyContacts: emergencyContacts.map((c) => ({
      name: (c.name || '').trim(),
      phone: c.phone.trim(),
    })),
    createdAt: new Date().toISOString(),
  };

  await transact((data) => {
    data.profiles[id] = profile;
  });

  const sosUrl = `${getBaseUrl(req)}/sos/${id}`;
  const qrDataUrl = await QRCode.toDataURL(sosUrl, { width: 400, margin: 2 });

  res.status(201).json({ profile, sosUrl, qrDataUrl });
});

// Public, minimal profile info needed to render the SOS screen (no full contact list).
router.get('/:id/public', (req, res) => {
  const data = load();
  const profile = data.profiles[req.params.id];
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  res.json({
    id: profile.id,
    name: profile.name,
    bloodGroup: profile.bloodGroup,
    medicalNotes: profile.medicalNotes,
    contactCount: profile.emergencyContacts.length,
  });
});

// Regenerate the printable QR code for an existing profile.
router.get('/:id/qrcode', async (req, res) => {
  const data = load();
  const profile = data.profiles[req.params.id];
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  const sosUrl = `${getBaseUrl(req)}/sos/${profile.id}`;
  const qrDataUrl = await QRCode.toDataURL(sosUrl, { width: 400, margin: 2 });
  res.json({ sosUrl, qrDataUrl });
});

module.exports = router;
