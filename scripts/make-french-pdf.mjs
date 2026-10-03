#!/usr/bin/env node
/**
 * Fabrique un petit PDF francais AVEC couche texte (pas une image), pour
 * comparer ce que `unpdf` et MinerU lisent du meme fichier. Les accents sont
 * encodes en WinAnsi (/Encoding /WinAnsiEncoding), ce qui est le cas normal
 * d'un PDF produit par Word ou LibreOffice.
 *
 * Usage : node scripts/make-french-pdf.mjs [sortie.pdf]
 */
import { writeFileSync } from 'node:fs';

const OUT = process.argv[2] || 'tmp-fr-test.pdf';

// WinAnsi differe de Latin-1 sur une poignee de caracteres typographiques.
const WINANSI_EXTRA = { '€': 0x80, '—': 0x97, '–': 0x96, '’': 0x92, '‘': 0x91, 'œ': 0x9c, 'Œ': 0x8c, '…': 0x85 };

function toWinAnsi(text) {
  let out = '';
  for (const ch of text) {
    if (ch in WINANSI_EXTRA) out += String.fromCharCode(WINANSI_EXTRA[ch]);
    else if (ch.charCodeAt(0) < 256) out += ch;
    else throw new Error(`caractere non representable en WinAnsi : ${ch}`);
  }
  return out;
}

const esc = (s) => toWinAnsi(s).replace(/[\\()]/g, (m) => '\\' + m);

// --- contenu de la page ------------------------------------------------------
const lines = [
  [50, 800, 18, 'Comptabilité — La TVA expliquée'],
  [50, 776, 12, 'Chapitre 3 : régimes, déclarations, écritures'],
  [50, 744, 11, "Une entreprise assujettie collecte la TVA pour le compte de l'État."],
  [50, 728, 11, 'Le taux normal est de 20 %. Les taux réduits sont 10 %, 5,5 % et 2,1 %.'],
  [50, 712, 11, 'Écriture : débit du compte 44566 « TVA déductible », crédit du 401.'],
  [50, 696, 11, "Attention : l'exercice comptable débute le 1er janvier et s'achève le 31 décembre."],
  [50, 680, 11, 'Mentions obligatoires : numéro SIRET, date, montant hors taxes, TVA, TTC.'],
];

// Tableau : colonnes bien separees cette fois, pour juger la fidelite.
const table = [
  [50, 640, 'Opération'], [230, 640, 'Base HT'], [340, 640, 'Taux'], [430, 640, 'TVA'], [520, 640, 'TTC'],
  [50, 622, 'Vente de marchandises'], [230, 622, '1 500,00 €'], [340, 622, '20 %'], [430, 622, '300,00 €'], [520, 622, '1 800,00 €'],
  [50, 604, 'Prestation de service'], [230, 604, '800,00 €'], [340, 604, '10 %'], [430, 604, '80,00 €'], [520, 604, '880,00 €'],
  [50, 586, 'Achat fournisseur'], [230, 586, '2 000,00 €'], [340, 586, '20 %'], [430, 586, '400,00 €'], [520, 586, '2 400,00 €'],
];

let content = 'BT\n/F1 11 Tf\n';
for (const [x, y, size, text] of lines) {
  content += `/F1 ${size} Tf\n1 0 0 1 ${x} ${y} Tm\n(${esc(text)}) Tj\n`;
}
for (const [x, y, text] of table) {
  content += `/F1 10 Tf\n1 0 0 1 ${x} ${y} Tm\n(${esc(text)}) Tj\n`;
}
content += 'ET\n';

// Les accents ne survivent que si on ecrit des octets WinAnsi bruts.
const contentBytes = Buffer.from(content, 'latin1');

// --- assemblage --------------------------------------------------------------
const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
  null, // 4 = flux de contenu, assemble plus bas
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
];

const chunks = [];
let pdf = '%PDF-1.4\n';
const offsets = [0];
for (let i = 0; i < objects.length; i++) {
  offsets[i + 1] = Buffer.byteLength(pdf, 'latin1');
  if (i === 3) {
    const head = `4 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`;
    pdf += head;
    chunks.push(Buffer.from(pdf, 'latin1'));
    chunks.push(contentBytes);
    pdf = 'endstream\nendobj\n';
  } else {
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
}

const xrefOffset = chunks.reduce((n, b) => n + b.length, 0) + Buffer.byteLength(pdf, 'latin1');
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (let i = 1; i <= objects.length; i++) {
  pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
}
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

chunks.push(Buffer.from(pdf, 'latin1'));
const out = Buffer.concat(chunks);
writeFileSync(OUT, out);
console.log(`${OUT} ecrit (${out.length} octets)`);
