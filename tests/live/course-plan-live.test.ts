/**
 * Live end-to-end check of the outline stage against the real free-tier models.
 *
 * Runs only when OPENMAIC_LIVE_TTS=1-style opt-in is set, so the default
 * `pnpm test` stays offline and hermetic:
 *
 *   OPENMAIC_LIVE_OUTLINE=1 npx vitest run tests/live/course-plan-live.test.ts
 *
 * The generator emits course plans as JSON, and this measures the two things
 * that decide whether a course is usable: JSON integrity (a fenced or truncated
 * response yields a dead course) and interaction density (a plan that is all
 * slides teaches nothing).
 */
import { describe, expect, it } from 'vitest';
import { generateText } from 'ai';
import { resolveModel } from '@/lib/server/resolve-model';
import { buildOutlinePrompt } from '@openmaic/generation';

/** A short but real passage, so `sourceExcerpt` has something to quote. */
const SOURCE = `
La TVA est un impôt indirect prélevé sur la consommation. L'assujetti collecte la
TVA auprès de ses clients et la reverse à l'État. Le taux normal en France est de
20 %. Le taux réduit de 5,5 % s'applique à certains produits de première nécessité
comme les produits alimentaires et les livres. Une facture doit mentionner la TVA
en taux normal et en taux réduit lorsqu'elle s'applique. L'assujetti déduit la TVA
collectée de la TVA due sur ses achats. Le crédit de TVA est la différence entre la
TVA collectée sur les ventes et la TVA déductible sur les achats.
`;

/**
 * Groq's free tier caps requests at 8,000 tokens per minute, and the outline
 * prompt plus a full document passes that on its own. The plan-level rules
 * under test do not depend on document length, so this comparison runs on a
 * short extract and compares like for like.
 */
const SHORT_SOURCE = `
La TVA est un impôt indirect sur la consommation. L'assujetti la collecte auprès
de ses clients et la reverse à l'État. Le taux normal est de 20 %. Le taux réduit
de 5,5 % concerne les produits alimentaires et les livres. Le crédit de TVA est
la différence entre la TVA collectée sur les ventes et la TVA déductible sur les
achats.
`;

const LIVE = process.env.OPENMAIC_LIVE_OUTLINE === '1';
const MODEL = process.env.OPENMAIC_LIVE_MODEL ?? 'groq:openai/gpt-oss-120b';
/** Short extract keeps the request under Groq's 8k TPM cap for A/B runs. */
const SHORT = process.env.OPENMAIC_LIVE_SHORT === '1';

interface Scene {
  type?: string;
  title?: string;
  sourceExcerpt?: string;
}

function analyse(raw: string) {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  const parsed = JSON.parse(cleaned) as {
    courseTitle?: string;
    outlines?: Scene[];
  };
  const scenes = Array.isArray(parsed.outlines) ? parsed.outlines : [];
  const byType = (t: string) => scenes.filter((s) => s.type === t).length;
  return {
    scenes,
    courseTitle: parsed.courseTitle ?? '',
    total: scenes.length,
    slides: byType('slide'),
    quiz: byType('quiz'),
    interactive: byType('interactive'),
    withExcerpt: scenes.filter(
      (s) => typeof s.sourceExcerpt === 'string' && s.sourceExcerpt.trim().length > 40,
    ).length,
  };
}

describe.skipIf(!LIVE)('live course plan generation', () => {
  it(
    'produces a parseable plan with acting scenes and document-grounded excerpts',
    async () => {
      const { model } = await resolveModel({ modelString: MODEL });
      const prompt = buildOutlinePrompt(
        {
          requirement:
            'Explique la TVA à un étudiant en comptabilité de la licence 1, en français, à partir du document fourni.',
        },
        { pdfText: SHORT ? SHORT_SOURCE : SOURCE, researchContext: '', teacherContext: '' },
      );

      const res = await generateText({
        model,
        system: prompt.system,
        prompt: prompt.user,
        maxOutputTokens: 8192,
      });

      const stats = analyse(res.text);
      const acting = stats.quiz + stats.interactive;
      const ratio = stats.total ? acting / stats.total : 0;

      console.log(
        `\n[${MODEL}] titre="${stats.courseTitle}" scenes=${stats.total} ` +
          `(slide=${stats.slides} quiz=${stats.quiz} interactive=${stats.interactive})\n` +
          `  rythme : ${stats.scenes.map((s) => s.type ?? '?').join(' → ')}\n` +
          `  actions=${acting}/${stats.total} (${Math.round(ratio * 100)}%) ` +
          `sourceExcerpt=${stats.withExcerpt}/${stats.total}`,
      );

      // A course with no acting scene is a slideshow, not a course.
      expect(ratio).toBeGreaterThan(0);
      // The whole point of option A: the content stage must have something to quote.
      expect(stats.withExcerpt).toBeGreaterThan(0);
    },
    180_000,
  );
});