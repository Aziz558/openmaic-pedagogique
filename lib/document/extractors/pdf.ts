import { createHash } from 'node:crypto';
import { parseWithMinerUCloud } from '@/lib/pdf/mineru-cloud';
import { parsePDF, parseWithMinerUDocument } from '@/lib/pdf/pdf-providers';
import { PDF_PROVIDERS } from '@/lib/pdf/constants';
import type { PDFProviderId } from '@/lib/pdf/types';
import { DOCUMENT_MIME_TYPES } from '../mime';
import { parsedPdfToDocumentArtifact } from '../pdf-compat';
import type { DocumentExtractorInput, DocumentExtractorProvider } from '../types';
import { getDocumentExtractorManifestEntry, type DocumentExtractorManifestEntry } from './manifest';

/** In-memory extraction cache keyed by (providerId, sha256 of buffer).
 * Avoids re-parsing the same PDF on every reload — critical on free-tier
 * serverless where every extraction costs time and provider quota. */
const extractionCache = new Map<string, DocumentArtifact>();
const MAX_CACHE_ENTRIES = 200;

function cacheKey(providerId: string, buffer: Buffer): string {
  return `${providerId}:${createHash('sha256').update(buffer).digest('hex')}`;
}

function cacheGet(key: string): DocumentArtifact | undefined {
  return extractionCache.get(key);
}

function cacheSet(key: string, artifact: DocumentArtifact): void {
  if (extractionCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = extractionCache.keys().next().value;
    if (firstKey !== undefined) extractionCache.delete(firstKey);
  }
  extractionCache.set(key, artifact);
}

/** Minimum text length below which we consider the extraction unusable
 * and fall back to a secondary pass. A real course document always yields
 * more than a few dozen characters of text. */
const MIN_EXTRACTED_TEXT_CHARS = 50;

/** The manifest entry backing a PDF provider, or a loud failure at module init. */
function pdfManifestEntry(id: PDFProviderId): DocumentExtractorManifestEntry {
  const entry = getDocumentExtractorManifestEntry(id);
  if (!entry) {
    throw new Error(`No document extractor manifest entry for PDF provider "${id}"`);
  }
  return entry;
}

function createPdfBackedDocumentExtractor(id: PDFProviderId): DocumentExtractorProvider {
  return {
    // Metadata comes from the browser-safe manifest — single source of truth
    // for the extractor identity (RFC #1153 part 1); the implementation is
    // attached here. `pdfManifestEntry` throws at module init if a
    // PDF_PROVIDERS entry ever lacks a manifest entry, and the registry sync
    // test pins the reverse direction (no orphan manifest entries).
    ...pdfManifestEntry(id),
    async extract(input: DocumentExtractorInput) {
      const cacheK = cacheKey(id, input.buffer);
      const cached = cacheGet(cacheK);
      if (cached) return cached;

      const config = {
        providerId: id,
        apiKey: input.config.apiKey,
        baseUrl: input.config.baseUrl,
        accessKeyId: input.config.accessKeyId,
        accessKeySecret: input.config.accessKeySecret,
        allowEnvFallback: input.config.allowEnvFallback,
        textOnly: input.config.textOnly,
        managed: input.config.managed,
      };
      let parsed;
      if (id === 'alidocmind') {
        // AliDocMind handles pdf/docx/pptx/xlsx/images through one flow.
        parsed = await parsePDF(config, input.buffer, {
          fileName: input.fileName,
          mimeType: input.mimeType,
        });
      } else if (id === 'mineru-cloud') {
        parsed = await parseWithMinerUCloud(config, input.buffer, input.fileName);
      } else if (id === 'mineru') {
        // Self-host MinerU routes every type (incl. pdf) through /file_parse.
        parsed = await parseWithMinerUDocument(config, input.buffer, {
          fileName: input.fileName || 'document.pdf',
          mimeType: input.mimeType,
        });
      } else if (input.mimeType === DOCUMENT_MIME_TYPES.pdf) {
        parsed = await parsePDF(config, input.buffer);
      } else {
        parsed = await parseWithMinerUDocument(config, input.buffer, {
          fileName: input.fileName || 'document',
          mimeType: input.mimeType,
        });
      }

      const artifact = parsedPdfToDocumentArtifact(parsed, input);

      // Fallback chain: if text extraction returned nothing usable, try once
      // more in text-only mode (skips images, faster, less likely to fail),
      // then surface a clear error instead of silently generating from empty.
      const extractedText = artifact.blocks
        .filter((b) => b.type === 'text' || b.type === 'markdown')
        .map((b) => b.text ?? '')
        .join('\n')
        .trim();

      if (extractedText.length < MIN_EXTRACTED_TEXT_CHARS && id !== 'unpdf' && input.mimeType === DOCUMENT_MIME_TYPES.pdf) {
        const fallback = await parsePDF(
          { ...config, providerId: 'unpdf', textOnly: true },
          input.buffer,
          { fileName: input.fileName, mimeType: input.mimeType },
        );
        const fallbackArtifact = parsedPdfToDocumentArtifact(fallback, input);
        const fallbackText = fallbackArtifact.blocks
          .filter((b) => b.type === 'text' || b.type === 'markdown')
          .map((b) => b.text ?? '')
          .join('\n')
          .trim();
        if (fallbackText.length >= MIN_EXTRACTED_TEXT_CHARS) {
          cacheSet(cacheK, fallbackArtifact);
          return fallbackArtifact;
        }
      }

      cacheSet(cacheK, artifact);
      return artifact;
    },
  };
}

export const pdfDocumentExtractorProviders: DocumentExtractorProvider[] = Object.keys(
  PDF_PROVIDERS,
).map((id) => createPdfBackedDocumentExtractor(id as PDFProviderId));
