import { resolveModel } from '@/lib/server/resolve-model';
import { generateText } from 'ai';

/**
 * Balayage de maxOutputTokens chez Groq (free tier).
 * Hypothese : le palier gratuit reserve les tokens DEMANDES (max_tokens) dans son
 * budget de 8 000 TPM, pas les tokens réellement produits. OpenMAIC, lui, demande
 * `modelInfo.outputWindow` (= 67 072 pour gpt-oss-120b) a chaque appel de generation.
 * Si l'hypothese est vraie, toute generation longue est refusee (413) ou tronquee.
 *
 * Ce script trouve le PLAFOND UTILISABLE reel, par modele.
 */
const MODELS = ['groq:openai/gpt-oss-120b', 'groq:qwen/qwen3.8-27b'];
// 67 072 = ce que le catalogue OpenMAIC declare pour gpt-oss-120b, donc ce que l'app demande.
// 1 500  = le plafond que l'article recommande sur le free tier.
const CEILINGS = [1500, 67072];

// Prompt volontairement minuscule : si ca casse, c'est bien le plafond demande qui est en cause.
const PROMPT = 'Ecris exactement 30 phrases courtes numerotees sur la TVA. Une phrase par ligne.';

const WAIT_MS = 65_000; // fenetre glissante de 60 s chez Groq

async function probe(modelString: string, ceiling: number) {
  const t0 = Date.now();
  try {
    const { model } = await resolveModel({ modelString });
    const res = await generateText({ model, prompt: PROMPT, maxOutputTokens: ceiling });
    const s = ((Date.now() - t0) / 1000).toFixed(1);
    const used = (res as any).usage?.completionTokens ?? '?';
    return `OK     ${String(res.text.length).padStart(6)} car | sortie=${String(used).padStart(5)} | ${s} s`;
  } catch (e) {
    const msg = String(e).replace(/\s+/g, ' ').slice(0, 190);
    return `ECHEC  ${msg}`;
  }
}

async function main() {
  console.log('=== BALAYAGE maxOutputTokens (Groq free tier) ===');
  for (const m of MODELS) {
    console.log('\n' + m);
    for (const c of CEILINGS) {
      console.log(`  max=${String(c).padStart(6)}  ${await probe(m, c)}`);
      await new Promise((r) => setTimeout(r, WAIT_MS));
    }
  }
  console.log('\nTermine.');
}

main().catch((e) => {
  console.error('ECHEC:', e);
  process.exit(1);
});
