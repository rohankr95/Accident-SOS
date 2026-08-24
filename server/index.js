require('dotenv').config();
const path = require('path');
const express = require('express');

const profilesRouter = require('./routes/profiles');
const sosRouter = require('./routes/sos');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/profiles', profilesRouter);
app.use('/api/sos', sosRouter);

// Clean URLs for the two main screens.
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'register.html'));
});
app.get('/sos/:id', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'sos.html'));
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Accident SOS server running on http://localhost:${PORT}`);
});
