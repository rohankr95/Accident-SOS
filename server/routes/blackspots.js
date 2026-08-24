const express = require('express');
const { nanoid } = require('nanoid');
const QRCode = require('qrcode');
const { transact, load } = require('../db');
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

function cleanContact(c) {
  if (!c) return null;
  const name = (c.name || '').trim();
  const phone = (c.phone || '').trim();
  if (!phone) return null;
  return { name, phone };
}

// Create a customizable blackspot: a fixed location with pre-configured
// nearest police / hospital / ambulance contacts, plus a QR code to print
// and install on-site.
router.post('/', async (req, res) => {
  const { locationName, description, lat, lng, police, hospital, ambulance } = req.body || {};

  if (!locationName || typeof locationName !== 'string' || !locationName.trim()) {
    return res.status(400).json({ error: 'locationName is required' });
  }
  if (!isValidCoord(lat, lng)) {
    return res.status(400).json({ error: 'Valid lat/lng for the blackspot location is required' });
  }

  const policeContact = cleanContact(police);
  const hospitalContact = cleanContact(hospital);
  const ambulanceContact = cleanContact(ambulance);
  if (!policeContact && !hospitalContact && !ambulanceContact) {
    return res.status(400).json({ error: 'At least one of police, hospital, or ambulance contact is required' });
  }

  const id = nanoid(10);
  const blackspot = {
    id,
    locationName: locationName.trim(),
    description: (description || '').trim(),
    lat,
    lng,
    police: policeContact,
    hospital: hospitalContact,
    ambulance: ambulanceContact,
    createdAt: new Date().toISOString(),
  };

  await transact((data) => {
    if (!data.blackspots) data.blackspots = {};
    data.blackspots[id] = blackspot;
  });

  const scanUrl = `${getBaseUrl(req)}/blackspot/${id}`;
  const qrDataUrl = await QRCode.toDataURL(scanUrl, { width: 400, margin: 2 });

  res.status(201).json({ blackspot, scanUrl, qrDataUrl });
});

// Public info shown on the scan page: location, description, and the
// pre-configured contacts (name + phone) for one-tap calling.
router.get('/:id/public', (req, res) => {
  const data = load();
  const blackspot = (data.blackspots || {})[req.params.id];
  if (!blackspot) return res.status(404).json({ error: 'Blackspot not found' });
  res.json(blackspot);
});

router.get('/:id/qrcode', async (req, res) => {
  const data = load();
  const blackspot = (data.blackspots || {})[req.params.id];
  if (!blackspot) return res.status(404).json({ error: 'Blackspot not found' });
  const scanUrl = `${getBaseUrl(req)}/blackspot/${blackspot.id}`;
  const qrDataUrl = await QRCode.toDataURL(scanUrl, { width: 400, margin: 2 });
  res.json({ scanUrl, qrDataUrl });
});

// Raise an alert for this blackspot. Uses the blackspot's fixed, known
// coordinates by default (no location permission needed — the sign is
// physically at that spot), optionally overridden with a more precise
// live GPS fix from the scanner's phone if one was obtained.
router.post('/:id/alert', async (req, res) => {
  const { id } = req.params;
  const { lat, lng, accuracy } = req.body || {};

  const data = load();
  const blackspot = (data.blackspots || {})[id];
  if (!blackspot) return res.status(404).json({ error: 'Blackspot not found. Check the QR code / link.' });

  const useLat = isValidCoord(lat, lng) ? lat : blackspot.lat;
  const useLng = isValidCoord(lat, lng) ? lng : blackspot.lng;
  const mapsUrl = `https://www.google.com/maps?q=${useLat},${useLng}`;

  const incidentId = nanoid(12);
  const message =
    `ACCIDENT ALERT at ${blackspot.locationName}. A road accident has just been reported at this ` +
    `known blackspot and needs urgent help. ` +
    (blackspot.description ? `${blackspot.description}. ` : '') +
    `Location: ${mapsUrl}` +
    (isValidCoord(lat, lng) ? ` (live GPS, accuracy ~${Math.round(accuracy || 0)}m)` : ' (registered blackspot location)') +
    `. Sent automatically via Accident SOS.`;

  const contacts = [
    blackspot.police && { ...blackspot.police, role: 'police' },
    blackspot.hospital && { ...blackspot.hospital, role: 'hospital' },
    blackspot.ambulance && { ...blackspot.ambulance, role: 'ambulance' },
  ].filter(Boolean);

  const notified = await Promise.all(
    contacts.map(async (c) => {
      const [sms, call] = await Promise.all([
        sendSms(c.phone, message),
        placeVoiceCall(c.phone, message),
      ]);
      return { role: c.role, name: c.name, phone: c.phone, sms, call };
    })
  );

  const incident = {
    id: incidentId,
    type: 'blackspot',
    blackspotId: id,
    lat: useLat,
    lng: useLng,
    liveLocation: isValidCoord(lat, lng),
    accuracy: accuracy || null,
    mapsUrl,
    createdAt: new Date().toISOString(),
    notified,
  };

  await transact((d) => {
    d.incidents[incidentId] = incident;
  });

  res.status(201).json({ incidentId, mapsUrl, notified });
});

module.exports = router;
