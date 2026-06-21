import { logger } from '@procurement/common';

/**
 * Extract plain text from an already-downloaded file buffer.
 * PDF is supported via pdf-parse; plain text passes through. DOCX/other binary
 * formats are an explicit v1 limitation — they return null so callers can report
 * "unsupported format" rather than feeding garbage to the model.
 *
 * Note: ai-service does NOT touch S3 directly — it receives the file bytes from
 * document-service's presigned URL (see platform-data.ts).
 */
export const extractText = async (
  buffer: Buffer,
  mimeType: string,
  originalName: string
): Promise<{ text: string | null; reason?: string }> => {
  const name = (originalName || '').toLowerCase();
  const isPdf = mimeType === 'application/pdf' || name.endsWith('.pdf');
  const isPlain = mimeType?.startsWith('text/') || name.endsWith('.txt');

  if (isPlain) {
    return { text: buffer.toString('utf-8') };
  }

  if (isPdf) {
    try {
      const pdfParse = require('pdf-parse');
      const parsed = await pdfParse(buffer);
      const text = (parsed.text || '').trim();
      if (!text) return { text: null, reason: 'The PDF appears to contain no extractable text (it may be a scanned image).' };
      return { text };
    } catch (err) {
      logger.error('pdf-parse failed: ' + (err as Error).message);
      return { text: null, reason: 'Could not extract text from the PDF.' };
    }
  }

  return { text: null, reason: `Unsupported file type for analysis (${mimeType || originalName}). Only PDF and plain text are supported in this version.` };
};
