const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------
// Stockage simple : un seul fichier JSON servant de base
// clé/valeur (facile à migrer vers SQLite/MongoDB plus tard,
// il suffira de remplacer readStore()/writeStore()).
// ---------------------------------------------------------
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'store.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, '{}');

function readStore() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  } catch (e) {
    console.error('Erreur de lecture du store, réinitialisation.', e);
    return {};
  }
}

function writeStore(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// --- API clé/valeur (même logique que le stockage d'artefact) ---

app.get('/api/storage/:key', (req, res) => {
  const store = readStore();
  const value = store[req.params.key];
  if (value === undefined) return res.status(404).json({ error: 'not_found' });
  res.json({ key: req.params.key, value });
});

app.post('/api/storage/:key', (req, res) => {
  const store = readStore();
  store[req.params.key] = req.body.value;
  writeStore(store);
  res.json({ key: req.params.key, value: req.body.value });
});

app.delete('/api/storage/:key', (req, res) => {
  const store = readStore();
  delete store[req.params.key];
  writeStore(store);
  res.json({ deleted: true });
});

// Toute autre route renvoie l'app (SPA simple)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✅ Serveur lancé : http://localhost:${PORT}`);
  console.log(`   Tableau de bord : http://localhost:${PORT}`);
  console.log(`   (Les liens clients ressembleront à http://localhost:${PORT}/?projet=CDC-XXXXX)\n`);
});
