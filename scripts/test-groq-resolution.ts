import { resolveApiKey, resolveBaseUrl, isServerConfiguredProvider } from '@/lib/server/provider-config';
import { getProvider, parseModelString } from '@/lib/ai/providers';
import { resolveModel } from '@/lib/server/resolve-model';
import { generateText, streamText } from 'ai';

async function main() {
  console.log('=== 1. RESOLUTION CONFIG GROQ ===');
  const key = resolveApiKey('groq');
  console.log('  resolveApiKey          :', key ? `${key.slice(0, 10)}…` : 'NONE');
  console.log('  resolveBaseUrl         :', resolveBaseUrl('groq') ?? '(defaultBaseUrl du catalog)');
  console.log('  isServerConfigured     :', isServerConfiguredProvider('providers', 'groq'));
  const cfg = getProvider('groq');
  console.log('  catalog                :', cfg?.models?.map((m) => m.id).join(', '));
  console.log('  defaultBaseUrl         :', cfg?.defaultBaseUrl);
  console.log('  parseModelString       :', JSON.stringify(parseModelString('groq:openai/gpt-oss-120b')));

  console.log('\n=== 2. APPEL SORTANT VIA LE TRANSPORT DE L APP (resolveModel) ===');
  for (const id of cfg!.models!.map((m) => m.id)) {
    const resolved = await resolveModel({ modelString: `groq:${id}` });
    console.log(`\n  > groq:${id}`);
    console.log('    provider réellement monté :', resolved.model.provider);

    const t0 = Date.now();
    const res = await generateText({
      model: resolved.model,
      prompt: 'Quelle est la capitale de Madagascar ? Réponds en 3 mots maximum.',
    });
    const s = ((Date.now() - t0) / 1000).toFixed(2);
    console.log(`    generateText (${s} s) : ${res.text.trim()}`);
  }

  console.log('\n=== 3. STREAMING (découpe SSE) ===');
  const st = await resolveModel({ modelString: 'groq:qwen/qwen3.8-27b' });
  const t0 = Date.now();
  const stream = streamText({ model: st.model, prompt: 'Compte de 1 à 5, un nombre par ligne.' });
  let full = '';
  for await (const chunk of stream.textStream) full += chunk;
  console.log(`  streamText (${((Date.now() - t0) / 1000).toFixed(2)} s) :`, JSON.stringify(full.trim()));

  console.log('\n=== 4. SECOURS (MODEL_FALLBACK) ===');
  process.env.MODEL_FALLBACK = 'groq:openai/gpt-oss-120b';
  const { resolveFallbackModel } = await import('@/lib/server/llm-fallback');
  const fb = await resolveFallbackModel('scene-content');
  console.log('  résolu  :', fb ? fb.modelString : 'null (aucun secours)');
  if (fb) {
    const t1 = Date.now();
    const r = await generateText({
      model: fb.model,
      prompt: 'Un mot seulement : la réponse.',
    });
    console.log(`  appel   : ${((Date.now() - t1) / 1000).toFixed(2)} s -> ${r.text.trim()}`);
  }
}

main().catch((err) => {
  console.error('ECHEC:', err);
  process.exit(1);
});

