#!/usr/bin/env node
/**
 * Envoie une image de document francais a l'extracteur configure dans OpenMAIC
 * et affiche le texte recupere. Sert a juger la QUALITE de l'extraction, pas
 * seulement le fait qu'elle reponde : c'est le point qui bloquait.
 *
 * Usage : node scripts/test-extract-fr.mjs [chemin.png] [providerId]
 */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const BASE = process.env.OPENMAIC_URL || 'http://localhost:3000';
const FILE = process.argv[2] || 'tmp-fr-test.png';
const PROVIDER = process.argv[3] || 'mineru-cloud';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

// 1) Cookie d'acces
const authRes = await fetch(`${BASE}/api/access-code/verify`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code: env.ACCESS_CODE }),
});
if (!authRes.ok) throw new Error(`authentification: HTTP ${authRes.status}`);
const cookie = (authRes.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
console.log("cookie d'acces obtenu\n");

// 2) Extraction
const MIME_BY_EXT = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.pdf': 'application/pdf' };
const ext = FILE.slice(FILE.lastIndexOf('.')).toLowerCase();
const mime = MIME_BY_EXT[ext] || 'application/octet-stream';

const buf = readFileSync(FILE);
const form = new FormData();
form.append('file', new Blob([buf], { type: mime }), basename(FILE));
form.append('providerId', PROVIDER);

console.log(`=== Extraction via ${PROVIDER} : ${basename(FILE)} (${buf.length} octets, ${mime}) ===`);
const t0 = Date.now();
const res = await fetch(`${BASE}/api/extract-document`, {
  method: 'POST',
  headers: { Cookie: cookie },
  body: form,
});
const secs = ((Date.now() - t0) / 1000).toFixed(1);
const raw = await res.text();

console.log(`HTTP ${res.status} en ${secs} s`);
let json;
try {
  json = JSON.parse(raw);
} catch {
  console.log(raw.slice(0, 2000));
  process.exit(1);
}

// Le texte peut etre a plusieurs endroits selon la forme de la reponse.
const text =
  json.text ??
  json.markdown ??
  json.content ??
  json.data?.text ??
  json.data?.markdown ??
  (json.blocks ? JSON.stringify(json.blocks, null, 1) : null);

console.log('cles de la reponse :', Object.keys(json).join(', '));
if (!text) {
  console.log('\n--- reponse brute (3000 car.) ---');
  console.log(JSON.stringify(json, null, 1).slice(0, 3000));
  process.exit(0);
}

console.log(`\n--- texte extrait : ${String(text).length} caracteres ---`);
console.log(String(text).slice(0, 3000));

// Quels caracteres accentues le texte extrait contient-il reellement ?
// On liste ce qui est present plutot que de condamner des lettres qui ne
// figurent pas dans le document source (faux negatifs).
const found = new Set();
for (const ch of 'éèêàâçôûùîïÉÈÀÇÔé€«»—') {
  if (String(text).includes(ch)) found.add(ch);
}
console.log('\n--- caracteres francais retrouves ---');
console.log('  ' + ([...found].join(' ') || '(aucun)'));

const mojibake = ['Ã©', 'Ã¨', 'Ã ', 'â‚¬', 'Ã´'];
const broken = mojibake.filter((m) => String(text).includes(m));
console.log('  encodage casse (Ã©, â‚¬...) : ' + (broken.length ? broken.join(' ') : 'aucun'));
