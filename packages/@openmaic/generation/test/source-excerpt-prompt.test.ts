import { expect, it, describe } from 'vitest';
import type { AICallFn, SceneOutline } from '@openmaic/generation';
import {
  generateSceneContent,
  generateWidgetContent,
  changeOutlineType,
} from '@openmaic/generation';
import { quizOutline, slideOutline, widgetOutline } from './scene-fixtures.js';

/**
 * The outline stage is the only stage that reads the document; the scene stage
 * receives `sourceExcerpt` as its only source of truth. These tests pin both
 * branches of that wiring, because the prompt loader is a hand-rolled regex
 * (not Handlebars): an unsupported `{{else}}` or a placeholder left in place
 * would be shipped verbatim to the model.
 */
const SOURCE = 'La TVA est collectée par l\'assujetti et reversée à l\'État. Le taux normal est de 20 %.';

/**
 * Option B: carrying the excerpt is only half the job. The system prompt must
 * also tell the model how to behave once it holds it — otherwise it still
 * reaches for its own subject knowledge, which is how a 20 % rate from the
 * learner's document quietly becomes 19.6 % from memory.
 */
const FIDELITY_RULES = [
  'Source Fidelity',
  'ground truth',
  'Never invent',
  'Mark the gap instead of filling it',
];

function expectFidelityRules(system: string): void {
  expect(system).toContain('Source Fidelity');
  expect(system).toContain('ground truth');
  expect(system).toContain('Never invent');
  expect(system).toContain('Mark the gap instead of filling it');
  // The snippet reference must be expanded, never forwarded to the model.
  expect(system).not.toContain('{{snippet:source-fidelity}}');
}

async function captureSystem(
  outline: ReturnType<typeof slideOutline>,
  output: string,
): Promise<string> {
  let captured = '';
  const capture: AICallFn = async (system) => {
    captured = system;
    return output;
  };
  await generateSceneContent(outline, capture, { languageDirective: 'Teach in French.' });
  return captured;
}

async function renderSlide(outline: ReturnType<typeof slideOutline>): Promise<string> {
  let captured = '';
  const capture: AICallFn = async (_system, user) => {
    captured = user;
    return JSON.stringify({ elements: [], background: { type: 'solid', color: '#fff' } });
  };
  await generateSceneContent(outline, capture, { languageDirective: 'Teach in French.' });
  return captured;
}

async function renderQuiz(outline: ReturnType<typeof quizOutline>): Promise<string> {
  let captured = '';
  const capture: AICallFn = async (_system, user) => {
    captured = user;
    return '[]';
  };
  await generateSceneContent(outline, capture, { languageDirective: 'Teach in French.' });
  return captured;
}

describe('scene prompt source material', () => {
  it('instructs the model to stay faithful to the document in the system prompt', async () => {
    // Option B. Without these rules the excerpt travels but is not obeyed: the
    // model fills gaps from its own knowledge, which is the exact failure the
    // learner cannot detect.
    const system = await captureSystem(
      { ...slideOutline(), sourceExcerpt: SOURCE },
      JSON.stringify({ elements: [], background: { type: 'solid', color: '#fff' } }),
    );

    for (const rule of FIDELITY_RULES) {
      expect(system).toContain(rule);
    }
    expectFidelityRules(system);
  });

  it('still forbids invention when no excerpt is supplied', async () => {
    // The fidelity rules are unconditional: a scene with no passage must fall
    // back to "cover only the brief", not to free invention.
    const system = await captureSystem(
      slideOutline(),
      JSON.stringify({ elements: [], background: { type: 'solid', color: '#fff' } }),
    );

    expectFidelityRules(system);
  });

  it('carries the document excerpt verbatim when the outline supplies one', async () => {
    const user = await renderSlide({ ...slideOutline(), sourceExcerpt: SOURCE });

    expect(user).toContain(SOURCE);
    expect(user).not.toContain('{{sourceExcerpt}}');
    expect(user).not.toContain('{{else}}');
    expect(user).toContain('ground truth');
  });

  it('drops the block and forbids invention when no excerpt is supplied', async () => {
    const outline = slideOutline();
    expect(outline.sourceExcerpt).toBeUndefined();

    const user = await renderSlide(outline);

    expect(user).not.toContain('{{sourceExcerpt}}');
    expect(user).not.toContain('{{#if');
    expect(user).not.toContain('{{else}}');
    // The unconditional guidance must survive so the model is told not to make
    // facts up when it has nothing to quote.
    expect(user).toContain('If no passage appears above');
    expect(user).toContain('Do NOT');
  });

  it('grounds quiz answers in the document excerpt', async () => {
    const user = await renderQuiz({ ...quizOutline(), sourceExcerpt: SOURCE });

    expect(user).toContain(SOURCE);
    expect(user).not.toContain('{{sourceExcerpt}}');
    expect(user).not.toContain('{{else}}');
    expect(user).toContain('ground truth');
    // The anti-hallucination fallback must survive even with an excerpt.
    expect(user).toContain('never');
    expect(user).toContain('introduce facts');
  });

  it('cap the excerpt so the scene request stays inside a free-tier ceiling', async () => {
    const oversized = `START ${'x'.repeat(10_000)} END`;
    const user = await renderSlide({ ...slideOutline(), sourceExcerpt: oversized });

    // The cap cuts the tail, never the head: the opening survives, so the
    // model keeps the passage's core statement instead of a severed fragment.
    expect(user).toContain('START');
    expect(user).not.toContain('END');
    expect(user).not.toContain('{{sourceExcerpt}}');
  });
});

describe('widget prompt source material', () => {
  async function renderWidget(outline: SceneOutline): Promise<string> {
    let captured = '';
    const capture: AICallFn = async (_system, user) => {
      captured = user;
      return '<!DOCTYPE html><html><body>widget</body></html>';
    };
    await generateWidgetContent(outline, capture, 'Teach in French.');
    return captured;
  }

  it('carries the document excerpt into the simulation prompt', async () => {
    const user = await renderWidget({ ...widgetOutline(), sourceExcerpt: SOURCE });

    expect(user).toContain(SOURCE);
    expect(user).not.toContain('{{sourceExcerpt}}');
    expect(user).toContain('ground truth');
  });

  it('drops the block and forbids invention when no excerpt is supplied', async () => {
    const user = await renderWidget(widgetOutline());

    expect(user).not.toContain('{{sourceExcerpt}}');
    expect(user).not.toContain('{{#if');
    expect(user).toContain('Do NOT invent');
  });
});

describe('outline type switch source material', () => {
  it('preserves the excerpt when the editor changes the scene type', () => {
    const withExcerpt: SceneOutline = { ...slideOutline(), sourceExcerpt: SOURCE };

    // Without this invariant the editor's type switch silently rebuilds the
    // outline field-by-field and the content stage goes back to inventing.
    expect(changeOutlineType(withExcerpt, 'quiz').sourceExcerpt).toBe(SOURCE);
    expect(changeOutlineType(withExcerpt, 'interactive').sourceExcerpt).toBe(SOURCE);
    expect(changeOutlineType(withExcerpt, 'pbl').sourceExcerpt).toBe(SOURCE);
  });
});
