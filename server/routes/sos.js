const express = require('express');
const { nanoid } = require('nanoid');
const { transact, load } = require('../db');
const { findNearestEmergencyServices } = require('../services/nearestServices');
const { sendSms, placeVoiceCall } = require('../services/notify');

const router = express.Router();

function getBaseUrl(req) {
  return process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
}

function isValidCoord(lat, lon) {
  return (
    typeof lat === 'number' && typeof lon === 'number' &&
    Number.isFinite(lat) && Number.isFinite(lon) &&
    lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
  );
}

// Trigger an accident alert for a given profile ID (the QR code target).
router.post('/:id/trigger', async (req, res) => {
  const { id } = req.params;
  const { lat, lng, accuracy } = req.body || {};

  const data = load();
  const profile = data.profiles[id];
  if (!profile) return res.status(404).json({ error: 'Profile not found. Check the QR code / link.' });

  if (!isValidCoord(lat, lng)) {
    return res.status(400).json({ error: 'Valid lat/lng location is required to raise an alert' });
  }

  const incidentId = nanoid(12);
  const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
  const message =
    `ACCIDENT ALERT: ${profile.name} may need urgent help. ` +
    `Location: ${mapsUrl} (accuracy ~${Math.round(accuracy || 0)}m). ` +
    `Blood group: ${profile.bloodGroup || 'unknown'}. ` +
    (profile.medicalNotes ? `Medical notes: ${profile.medicalNotes}. ` : '') +
    `Sent automatically via Accident SOS.`;

  // Look up nearest hospital/police in parallel with nothing blocking contact alerts.
  const nearestPromise = findNearestEmergencyServices(lat, lng).catch(() => ({ hospital: null, police: null }));

  const contactResults = await Promise.all(
    profile.emergencyContacts.map((c) => sendSms(c.phone, message).then((r) => ({ ...r, contactName: c.name })))
  );

  const nearest = await nearestPromise;

  const serviceResults = { hospital: null, police: null };
  const baseUrl = getBaseUrl(req);

  if (nearest.hospital) {
    const call = nearest.hospital.phone
      ? await placeVoiceCall(nearest.hospital.phone, message, baseUrl)
      : { status: 'no_contact_found' };
    serviceResults.hospital = { ...nearest.hospital, notification: call };
  }
  if (nearest.police) {
    const call = nearest.police.phone
      ? await placeVoiceCall(nearest.police.phone, message, baseUrl)
      : { status: 'no_contact_found' };
    serviceResults.police = { ...nearest.police, notification: call };
  }

  const incident = {
    id: incidentId,
    profileId: id,
    lat,
    lng,
    accuracy: accuracy || null,
    mapsUrl,
    createdAt: new Date().toISOString(),
    contactsNotified: contactResults,
    nearestServices: serviceResults,
  };

  await transact((d) => {
    d.incidents[incidentId] = incident;
  });

  res.status(201).json({ incidentId, mapsUrl, contactsNotified: contactResults, nearestServices: serviceResults });
});

router.get('/incident/:incidentId', (req, res) => {
  const data = load();
  const incident = data.incidents[req.params.incidentId];
  if (!incident) return res.status(404).json({ error: 'Incident not found' });
  res.json(incident);
});

module.exports = router;
