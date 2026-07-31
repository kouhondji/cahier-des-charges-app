const express = require('express');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const PDFDocument = require('pdfkit');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------
// Stockage simple : un seul fichier JSON servant de base
// clé/valeur (facile à migrer vers SQLite/MongoDB plus tard,
// il suffira de remplacer readStore()/writeStore()).
// ---------------------------------------------------------
// En local, les données sont stockées dans ./data
// En production sur Render, la variable d'environnement DATA_DIR pointera
// vers le disque persistant (ex: /var/data) pour que rien ne soit perdu
// entre deux mises à jour.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
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

// --- IA : génère des questions de clarification sur-mesure à partir
//     d'une description libre du besoin du client ---
app.post('/api/ai/questions', async (req, res) => {
  try {
    const description = (req.body.description || '').trim();
    if (!description) {
      return res.status(400).json({ error: 'description_required' });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'missing_api_key', message: 'ANTHROPIC_API_KEY non configurée sur le serveur.' });
    }

    const systemPrompt = `Tu es un consultant expert en cadrage de projets de développement web/logiciel.
Un client va te décrire librement son besoin. Ton travail est d'identifier les zones floues ou
manquantes de sa description, et de produire entre 5 et 8 questions de clarification PRÉCISES et
adaptées à SON projet (pas des questions génériques).

Réponds UNIQUEMENT avec un tableau JSON valide, sans texte avant/après, sans balises markdown.
Chaque élément du tableau doit avoir cette forme :
{"label": "Texte de la question", "type": "text|textarea|select", "required": true, "options": ["Option A","Option B"]}
- "type" vaut "select" seulement si un choix parmi quelques options précises fait sens (alors fournis "options").
- "type" vaut "textarea" pour une réponse développée, "text" pour une réponse courte.
- Ne mets jamais "options" pour type "text" ou "textarea".`;

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Description du client :\n\n${description}` }]
    });

    const rawText = msg.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('Réponse IA non-JSON:', rawText);
      return res.status(500).json({ error: 'ai_parse_error', message: 'La réponse de l\'IA n\'a pas pu être interprétée.' });
    }

    const questions = parsed.map((q, i) => ({
      id: 'aiq_' + i + '_' + Math.random().toString(36).slice(2, 7),
      type: q.type || 'textarea',
      label: q.label || '',
      required: q.required !== false,
      options: Array.isArray(q.options) ? q.options : []
    })).filter(q => q.label);

    res.json({ questions });
  } catch (e) {
    console.error('Erreur IA:', e);
    res.status(500).json({ error: 'ai_error', message: e.message });
  }
});

// --- PDF : génère un cahier des charges structuré à partir d'un contenu
//     déjà assemblé côté client (titre, méta-infos, sections de questions/réponses) ---
app.post('/api/pdf', (req, res) => {
  try {
    const { title, meta, sections } = req.body;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="cahier-des-charges.pdf"');

    const doc = new PDFDocument({ margin: 54 });
    doc.pipe(res);

    doc.fontSize(19).fillColor('#1C2333').text(title || 'Cahier des charges');
    doc.moveDown(0.3);
    if (meta && meta.length) {
      doc.fontSize(9).fillColor('#767C8C').text(meta.join('   ·   '));
    }
    doc.moveDown(0.8);
    doc.moveTo(54, doc.y).lineTo(541, doc.y).strokeColor('#D9D2C1').stroke();
    doc.moveDown(1);

    (sections || []).forEach(section => {
      doc.moveDown(0.4);
      doc.fontSize(13).fillColor('#2E5AAC').text(section.heading || '');
      doc.moveDown(0.35);
      (section.items || []).forEach(item => {
        doc.fontSize(9.5).fillColor('#767C8C').text(item.label || '');
        doc.fontSize(11).fillColor('#1C2333').text(item.answer || '—', { paragraphGap: 8 });
      });
    });

    doc.end();
  } catch (e) {
    console.error('Erreur PDF:', e);
    res.status(500).json({ error: 'pdf_error', message: e.message });
  }
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
