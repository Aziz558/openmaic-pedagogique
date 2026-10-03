import { resolveModel } from '@/lib/server/resolve-model';
import { generateText } from 'ai';

/**
 * Generation LONGUE et structuree : OpenMAIC produit des JSON de cours
 * (sequence -> scenes -> quiz). Une reponse tronquee = cours inutilisable.
 * On compare Groq et Gemini sur le MEME prompt, avec la meme fenetre de sortie.
 */
const PROMPT = `Rédige le plan complet d'un cours de 4 séquences sur "La TVA en comptabilité".
Réponds UNIQUEMENT par un objet JSON valide avec cette forme exacte :
{"titre":"...","sequences":[{"titre":"...","objectifs":["...","..."],"scenes":[{"titre":"...","duree_min":10,"points_cles":["...","...","..."],"quiz":[{"question":"...","propositions":["...","...","..."],"bonne_reponse":0}]}]}]}
Exige : 4 séquences, 3 scènes par séquence, 3 points clés et 1 quiz par scène. Sans aucun texte hors du JSON.`;

async function run(label: string, modelString: string) {
  const t0 = Date.now();
  try {
    const { model } = await resolveModel({ modelString });
    const res = await generateText({ model, prompt: PROMPT, maxOutputTokens: 8192 });
    const s = ((Date.now() - t0) / 1000).toFixed(2);
    const raw = res.text.trim();
    let jsonOk = false;
    let seq = -1;
    let scenes = -1;
    try {
      const parsed = JSON.parse(raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim());
      jsonOk = true;
      seq = Array.isArray(parsed.sequences) ? parsed.sequences.length : 0;
      scenes = Array.isArray(parsed.sequences)
        ? parsed.sequences.reduce((n: number, x: any) => n + (x.scenes?.length ?? 0), 0)
        : 0;
    } catch {
      jsonOk = false;
    }
    console.log(
      `  ${label.padEnd(26)} ${s} s | ${String(raw.length).padStart(6)} car` +
        ` | JSON ${jsonOk ? 'OK ' : 'KO '} | séq=${seq} scènes=${scenes}`,
    );
    if (!jsonOk) console.log('      début de réponse :', raw.slice(0, 160).replace(/\s+/g, ' '));
  } catch (e) {
    console.log(`  ${label.padEnd(26)} ECHEC: ${e}`);
  }
}

async function main() {
  console.log('=== GENERATION LONGUE STRUCTUREE (maxOutputTokens=8192) ===');
  await run('groq:openai/gpt-oss-120b', 'groq:openai/gpt-oss-120b');
  await run('groq:qwen/qwen3.8-27b', 'groq:qwen/qwen3.8-27b');
  await run('google:gemini-3.6-flash', 'google:gemini-3.6-flash');
}

main().catch((e) => {
  console.error('ECHEC:', e);
  process.exit(1);
});
