# Accident SOS

A QR-code based instant accident alert system.

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

> **Safety note:** This is a supplementary tool, not a replacement for
> dialing your local emergency number (112 / 100 / 108 / 911, etc.)
> directly whenever anyone at the scene is able to. Automated alerts can be
> delayed, fail to deliver, or reach an outdated/incorrect number pulled
> from OpenStreetMap data — always verify and follow up.

## How it works

```
Register  ->  QR code encodes https://<your-domain>/sos/<profileId>
Scan QR   ->  /sos/:id page requests GPS location
Trigger   ->  POST /api/sos/:id/trigger { lat, lng, accuracy }
                |-- SMS to each emergency contact (Twilio, or simulated)
                |-- Nearest hospital/police lookup (OpenStreetMap Overpass API)
                |-- Voice call to hospital/police if a phone number is known
                `-- Incident record saved to data/db.json
```

## Setup

```bash
npm install
cp .env.example .env
npm start
```

Open `http://localhost:3000` to create a profile and get your QR code.

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

## Notes and limitations

- **Nearest hospital/police lookup** uses OpenStreetMap's Overpass API,
  which is free and keyless but depends on community-maintained data —
  coverage and phone numbers vary by region. For production use, consider
  a paid places API (e.g. Google Places) or a curated list of local
  emergency service contacts.
- **Voice calls to services** only happen when OpenStreetMap has a phone
  number tagged for that hospital/police station. Emergency contacts
  always get an SMS regardless.
- Data is stored in `data/db.json` for simplicity. Swap in a real database
  before using this beyond a demo/prototype.
- Location accuracy depends on the scanning device's GPS/network signal.
