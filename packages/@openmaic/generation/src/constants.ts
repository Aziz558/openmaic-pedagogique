export const MAX_PDF_CONTENT_CHARS = 50_000;
/**
 * Cap on the per-scene `sourceExcerpt` carried from the outline into the scene
 * prompt. The excerpt is one passage, not the document: Groq's free tier
 * rejects any request above 8,000 tokens, and the scene prompt already carries
 * a long system message, so a few thousand characters is the budget that keeps
 * the call inside a free tier.
 */
export const MAX_SOURCE_EXCERPT_CHARS = 4_000;
export const MAX_VISION_IMAGES = 20;
