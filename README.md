# Accident SOS

A QR-code based instant accident alert system, with two QR modes:

- **Personal SOS QR** — one per person, stuck on a helmet/vehicle/ID.
- **Blackspot SOS QR** — one per fixed accident-prone location, installed
  on a roadside sign by a municipality/highway authority/community group,
  pre-loaded with that spot's nearest police, hospital, and ambulance
  contacts.

## Personal SOS QR

1. A person creates an emergency profile (name, blood group, medical notes,
   emergency contacts) and gets a personal QR code. They print it and stick
   it on their helmet, bike, car dashboard, or ID.
2. If they're in an accident, anyone nearby scans the QR code with a phone
   camera. It opens a web page — no app install needed.
3. The page grabs the scanner's/victim's GPS location (with a 5-second
   cancel window to avoid accidental triggers) and sends it to the server.
4. The server:
   - SMSes the victim's emergency contacts with a Google Maps link, blood
     group, and medical notes.
   - Looks up the **nearest hospital and police station** using
     OpenStreetMap (free, no API key) based on the reported location.
   - If a phone number is available for that hospital/police station, it
     places an automated voice call reading out the emergency and location
     (via Twilio, if configured).
   - Logs the incident (location, who/what was notified, and delivery
     status) so it can be reviewed later.

## Blackspot SOS QR

For a known accident-prone spot (a sharp curve, an unmarked junction,
a stretch with a history of accidents), an authority or community group
can create a **customizable QR code fixed to that exact location**:

1. At `/blackspot/new`, they enter the location name/landmark, its
   coordinates (a "use my current location" button auto-fills this since
   they're standing at the spot while installing the sign), and the
   **nearest police station, hospital, and ambulance contact numbers** for
   that location. This generates a QR code to print on a durable sign.
2. Anyone at the scene scans it and gets a page with:
   - One-tap **Call** buttons (`tel:` links) for police, hospital, and
     ambulance — dials directly from the scanner's own phone, instantly,
     with no server/API dependency.
   - A **Send Alert** button that notifies all three configured contacts
     at once (SMS + automated voice call via Twilio, or simulated) with
     the incident location. It works even without location permission,
     since the blackspot's own registered coordinates are used by default;
     if the phone provides a live GPS fix, that more precise location is
     used instead.
3. The incident (which contacts were notified, delivery status, location)
   is logged for review.

Because the contacts are curated per location ahead of time (rather than
looked up live), this mode doesn't depend on OpenStreetMap data quality at
the moment of the accident, and works for any location worldwide.

> **Safety note:** This is a supplementary tool, not a replacement for
> dialing your local emergency number (112 / 100 / 108 / 911, etc.)
> directly whenever anyone at the scene is able to. Automated alerts can be
> delayed, fail to deliver, or reach an outdated/incorrect number —
> always verify and follow up.

## How it works

```
Personal:
  Register  ->  QR code encodes https://<your-domain>/sos/<profileId>
  Scan QR   ->  /sos/:id page requests GPS location
  Trigger   ->  POST /api/sos/:id/trigger { lat, lng, accuracy }
                  |-- SMS to each emergency contact (Twilio, or simulated)
                  |-- Nearest hospital/police lookup (OpenStreetMap Overpass API)
                  |-- Voice call to hospital/police if a phone number is known
                  `-- Incident record saved to data/db.json

Blackspot:
  Register  ->  QR code encodes https://<your-domain>/blackspot/<id>
                  (location + pre-configured police/hospital/ambulance contacts)
  Scan QR   ->  /blackspot/:id page shows one-tap Call buttons (tel: links)
  Trigger   ->  POST /api/blackspots/:id/alert { lat?, lng?, accuracy? }
                  |-- SMS + voice call to police, hospital, ambulance
                  |   (Twilio, or simulated)
                  `-- Incident record saved to data/db.json
```

## Setup

```bash
npm install
cp .env.example .env
npm start
```

Open `http://localhost:3000` to create a personal QR code (`/register`) or
a blackspot QR code (`/blackspot/new`).

By default, without Twilio credentials, SMS/call sending is **simulated**
(logged to the server console) so you can test the entire flow for free.
To send real SMS/calls, fill in `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
and `TWILIO_FROM_NUMBER` in `.env` with a Twilio account.

For QR codes to work when scanned from a real phone, `PUBLIC_BASE_URL` must
point to a URL your phone can reach — e.g. expose your local server with a
tunnel (`ngrok http 3000`) during testing, or deploy the app and set
`PUBLIC_BASE_URL` to your production domain.

## API

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/profiles` | Create a profile; returns the profile, its SOS URL, and a QR code as a data URL |
| `GET`  | `/api/profiles/:id/public` | Minimal public profile info shown on the SOS page |
| `GET`  | `/api/profiles/:id/qrcode` | Regenerate the QR code for an existing profile |
| `POST` | `/api/sos/:id/trigger` | Raise an alert with `{ lat, lng, accuracy }`; notifies contacts and nearest services |
| `GET`  | `/api/sos/incident/:incidentId` | Look up a past incident record |
| `POST` | `/api/blackspots` | Create a blackspot; returns it, its scan URL, and a QR code as a data URL |
| `GET`  | `/api/blackspots/:id/public` | Public blackspot info (location, description, police/hospital/ambulance contacts) shown on the scan page |
| `GET`  | `/api/blackspots/:id/qrcode` | Regenerate the QR code for an existing blackspot |
| `POST` | `/api/blackspots/:id/alert` | Raise an alert with optional `{ lat, lng, accuracy }`; notifies the blackspot's configured police/hospital/ambulance contacts |

## Notes and limitations

- **Personal QR nearest hospital/police lookup** uses OpenStreetMap's
  Overpass API, which is free and keyless but depends on
  community-maintained data — coverage and phone numbers vary by region.
  For production use, consider a paid places API (e.g. Google Places) or a
  curated list of local emergency service contacts. **Blackspot QR** codes
  sidestep this entirely by having an admin curate the contacts once, up
  front, for that specific location.
- **Voice calls** require Twilio credentials; without them, calls/SMS are
  simulated (logged to the console) so the app is fully testable for free.
- The blackspot scan page's one-tap **Call** buttons (`tel:` links) work
  with no server dependency at all — they dial straight from the
  scanner's phone, so they still work if the backend or SMS/voice
  provider is unreachable.
- Data is stored in `data/db.json` for simplicity. Swap in a real database
  before using this beyond a demo/prototype.
- Location accuracy depends on the scanning device's GPS/network signal.
