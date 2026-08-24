const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '..', 'data', 'db.json');

function load() {
  if (!fs.existsSync(DB_FILE)) {
    return { profiles: {}, incidents: {} };
  }
  const raw = fs.readFileSync(DB_FILE, 'utf8').trim();
  if (!raw) return { profiles: {}, incidents: {} };
  return JSON.parse(raw);
}

function save(data) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Simple in-process queue so concurrent writes don't clobber each other.
let writeChain = Promise.resolve();
function transact(mutator) {
  writeChain = writeChain.then(() => {
    const data = load();
    const result = mutator(data);
    save(data);
    return result;
  });
  return writeChain;
}

module.exports = { load, save, transact };
