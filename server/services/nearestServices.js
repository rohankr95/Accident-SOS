const axios = require('axios');

const OVERPASS_URL = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';
const SEARCH_RADIUS_M = Number(process.env.SEARCH_RADIUS_M || 8000);

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function extractPhone(tags = {}) {
  return tags.phone || tags['contact:phone'] || tags['emergency:phone'] || null;
}

function elementLatLon(el) {
  if (el.type === 'node') return { lat: el.lat, lon: el.lon };
  if (el.center) return { lat: el.center.lat, lon: el.center.lon };
  return null;
}

/**
 * Queries OpenStreetMap (Overpass API) for the nearest amenity of a given kind
 * around a point, sorted by straight-line distance. This is a best-effort,
 * free/keyless lookup — data completeness (especially phone numbers) depends
 * on OpenStreetMap coverage in the area.
 */
async function findNearest(amenity, lat, lon, radius = SEARCH_RADIUS_M) {
  const query = `
    [out:json][timeout:15];
    (
      node["amenity"="${amenity}"](around:${radius},${lat},${lon});
      way["amenity"="${amenity}"](around:${radius},${lat},${lon});
      relation["amenity"="${amenity}"](around:${radius},${lat},${lon});
    );
    out center tags;
  `;

  const { data } = await axios.post(OVERPASS_URL, query, {
    headers: { 'Content-Type': 'text/plain' },
    timeout: 20000,
  });

  const candidates = (data.elements || [])
    .map((el) => {
      const pos = elementLatLon(el);
      if (!pos) return null;
      return {
        name: el.tags?.name || `Unnamed ${amenity}`,
        phone: extractPhone(el.tags),
        lat: pos.lat,
        lon: pos.lon,
        distanceMeters: Math.round(haversineMeters(lat, lon, pos.lat, pos.lon)),
        osmId: `${el.type}/${el.id}`,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  return candidates[0] || null;
}

async function findNearestEmergencyServices(lat, lon) {
  const [hospital, police] = await Promise.all([
    findNearest('hospital', lat, lon).catch(() => null),
    findNearest('police', lat, lon).catch(() => null),
  ]);
  return { hospital, police };
}

module.exports = { findNearestEmergencyServices, findNearest, haversineMeters };
