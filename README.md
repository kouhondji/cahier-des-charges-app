# Système de cahiers des charges — projet local

Application Node.js + Express. Les données (modèles, projets, réponses) sont
stockées dans `data/store.json`, un simple fichier — facile à comprendre,
facile à migrer vers une vraie base de données plus tard.

## 1. Lancer en local

Prérequis : Node.js installé (v18+ recommandé).

```bash
cd cahier-des-charges-app
npm install
npm start
```

Puis ouvrez : **http://localhost:3000**

- Tableau de bord admin : `http://localhost:3000`
- Lien à envoyer à un client (généré automatiquement dans l'appli) :
  `http://localhost:3000/?projet=CDC-XXXXX`

Toutes vos modifications (créer un modèle, créer un projet) sont sauvegardées
dans `data/store.json`. Vous pouvez ouvrir ce fichier avec un éditeur de texte
pour voir exactement ce qui est stocké — utile pour comprendre ou déboguer.

## 2. Avant de mettre en ligne : sécuriser l'accès admin

L'application a déjà un système de mot de passe admin intégré (voir l'écran
d'accueil). Assurez-vous de le configurer avant de partager l'URL publiquement
— sans ça, n'importe qui visitant votre domaine verrait le tableau de bord.

Pour une sécurité plus robuste en production, on peut envisager plus tard :
- limiter `/api/storage/*` en écriture aux requêtes authentifiées seulement,
- passer à un vrai système de sessions (ex: `express-session`).

## 3. Migrer vers un hébergement

Deux options simples, sans changer une ligne de code :

### Option A — Render / Railway (le plus simple)
1. Poussez ce dossier sur un repo GitHub.
2. Sur [render.com](https://render.com) ou [railway.app](https://railway.app) :
   "New Web Service" → connectez le repo.
3. Build command : `npm install` — Start command : `npm start`.
4. ⚠️ Le fichier `data/store.json` sera réinitialisé à chaque redéploiement
   sur ces plateformes (système de fichiers non persistant). Pour un usage
   sérieux, activez un "disque persistant" (Render propose ça), ou migrez
   vers une vraie base de données (voir section 5).

### Option B — VPS (Hetzner, DigitalOcean, OVH...)
1. Installez Node.js sur le serveur.
2. Copiez le dossier du projet (`scp` ou `git clone`).
3. `npm install && npm start`, puis utilisez **pm2** pour garder l'app active :
   ```bash
   npm install -g pm2
   pm2 start server.js --name cdc-app
   pm2 save
   ```
4. Mettez **Nginx** devant en reverse proxy (port 80/443 → port 3000), et
   activez le HTTPS avec **Certbot** (Let's Encrypt, gratuit).

Sur un VPS, `data/store.json` reste bien persistant entre les redémarrages.

## 4. Brancher votre nom de domaine

Chez votre registrar (OVH, Namecheap, etc.), pointez :
- un enregistrement **A** vers l'IP du VPS, ou
- un enregistrement **CNAME** vers l'URL fournie par Render/Railway.

## 5. Intégrer avec WordPress

Recommandé : gardez cette app Node.js **séparée** de WordPress (elle vit sur
son propre sous-domaine, ex: `outils.votredomaine.com`), puis dans WordPress :
- ajoutez un lien dans votre menu vers cette URL, ou
- intégrez-la dans une page via un `<iframe>` :
  ```html
  <iframe src="https://outils.votredomaine.com" style="width:100%;height:900px;border:0;"></iframe>
  ```

Cette approche évite de réécrire l'application en PHP et vous permet de
continuer à développer en Node.js, que vous maîtrisez déjà.

## 6. Étape suivante (optionnelle) : vraie base de données

Quand le fichier JSON devient limitant (beaucoup de projets simultanés), on
remplace simplement les fonctions `readStore()` / `writeStore()` dans
`server.js` par des requêtes SQLite ou PostgreSQL — le reste de l'app
(frontend, routes API) ne change pas.
