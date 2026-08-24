const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_FROM_NUMBER;

let client = null;
if (TWILIO_SID && TWILIO_TOKEN) {
  // Lazy require so the app still boots without the twilio package configured.
  const twilio = require('twilio');
  client = twilio(TWILIO_SID, TWILIO_TOKEN);
}

const isConfigured = Boolean(client && TWILIO_FROM);

/**
 * Sends an SMS. Falls back to a simulated (logged) send when Twilio
 * credentials aren't configured, so the app is usable end-to-end in a
 * local/demo environment without paid API keys.
 */
async function sendSms(toNumber, body) {
  if (!toNumber) {
    return { to: toNumber, status: 'skipped', reason: 'no phone number on file' };
  }
  if (!isConfigured) {
    console.log(`[SIMULATED SMS] to=${toNumber} body="${body}"`);
    return { to: toNumber, status: 'simulated' };
  }
  try {
    const msg = await client.messages.create({ to: toNumber, from: TWILIO_FROM, body });
    return { to: toNumber, status: 'sent', sid: msg.sid };
  } catch (err) {
    console.error(`[SMS FAILED] to=${toNumber}:`, err.message);
    return { to: toNumber, status: 'failed', error: err.message };
  }
}

/**
 * Places an outbound voice call that reads out an emergency message via
 * text-to-speech. Falls back to a simulated call when Twilio isn't
 * configured. Requires a publicly reachable baseUrl to host the TwiML.
 */
async function placeVoiceCall(toNumber, message, baseUrl) {
  if (!toNumber) {
    return { to: toNumber, status: 'skipped', reason: 'no phone number on file' };
  }
  if (!isConfigured) {
    console.log(`[SIMULATED CALL] to=${toNumber} message="${message}"`);
    return { to: toNumber, status: 'simulated' };
  }
  try {
    const twiml = `<Response><Say voice="alice" loop="2">${escapeXml(message)}</Say></Response>`;
    const call = await client.calls.create({
      to: toNumber,
      from: TWILIO_FROM,
      twiml,
    });
    return { to: toNumber, status: 'calling', sid: call.sid };
  } catch (err) {
    console.error(`[CALL FAILED] to=${toNumber}:`, err.message);
    return { to: toNumber, status: 'failed', error: err.message };
  }
}

function escapeXml(str) {
  return String(str).replace(/[<>&'"]/g, (c) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
  }[c]));
}

module.exports = { sendSms, placeVoiceCall, isConfigured };
