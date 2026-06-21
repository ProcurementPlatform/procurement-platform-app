import { invokeText, invokeEmbedding, logger } from '@procurement/common';
import { Embedding } from '../models/Embedding';
import { extractText } from './document-text';
import { CallerScope } from './rbac-scope.service';
import { platformData, fetchFileBuffer } from './platform-data';

const toPlain = (doc: any) => (doc && typeof doc.toJSON === 'function' ? doc.toJSON() : doc);

const CHUNK_CHARS = 2000;      // ~500 tokens
const CHUNK_OVERLAP = 200;     // ~10% overlap
const MAX_CANDIDATES = 800;    // safety cap on how many chunks we score in memory (see §7b scale note)

// ── Chunking ────────────────────────────────────────────────────────────────
const chunkText = (text: string): string[] => {
  const clean = text.replace(/\s+\n/g, '\n').trim();
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + CHUNK_CHARS, clean.length);
    // Prefer to break on a paragraph/sentence boundary near the end.
    if (end < clean.length) {
      const slice = clean.slice(start, end);
      const lastBreak = Math.max(slice.lastIndexOf('\n'), slice.lastIndexOf('. '));
      if (lastBreak > CHUNK_CHARS * 0.5) end = start + lastBreak + 1;
    }
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks.filter(Boolean);
};

const cosineSimilarity = (a: number[], b: number[]): number => {
  let dot = 0, na = 0, nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
};

export class SearchService {
  /** Resolve the vendor counterparty for a document, for RBAC denormalization. */
  private async resolveOwnerVendorId(token: string, doc: any): Promise<string | undefined> {
    try {
      if (doc.category === 'contract' && doc.relatedId) {
        const c = await platformData.contract(token, doc.relatedId);
        return c?.vendor;
      }
      if (doc.category === 'invoice' && doc.relatedId) {
        const i = await platformData.invoice(token, doc.relatedId);
        return i?.vendorId || i?.vendor;
      }
    } catch { /* best effort */ }
    return undefined;
  }

  /** Index an uploaded document: extract text, chunk, embed, store. Re-indexing replaces prior chunks. */
  async indexDocument(token: string, documentId: string) {
    const dl = await platformData.documentDownload(token, documentId);
    const doc = dl?.document;
    if (!doc) throw new Error('Document not found');

    const buffer = await fetchFileBuffer(dl.url);
    const { text, reason } = await extractText(buffer, doc.mimeType, doc.originalName);
    if (!text) throw new Error(reason || 'Could not extract text from this document.');

    // Remove any previous chunks for this document (idempotent re-index).
    try {
      const prior = await Embedding.query('documentId').using('embeddingDocumentIdIndex').eq(documentId).exec();
      await Promise.all(prior.map((p: any) => Embedding.delete({ _id: p._id })));
    } catch (err) {
      logger.warn('Could not clear prior embeddings: ' + (err as Error).message);
    }

    const ownerVendorId = await this.resolveOwnerVendorId(token, doc);
    const chunks = chunkText(text);
    let indexed = 0;

    for (let i = 0; i < chunks.length; i++) {
      try {
        const vector = await invokeEmbedding(chunks[i]);
        await Embedding.create({
          documentId,
          category: ['contract', 'invoice', 'purchase_order', 'vendor_certificate'].includes(doc.category) ? doc.category : 'other',
          relatedId: doc.relatedId,
          chunkIndex: i,
          chunkText: chunks[i],
          embedding: vector,
          tokenCount: Math.round(chunks[i].length / 4),
          ownerVendorId,
        });
        indexed++;
      } catch (err) {
        logger.error(`Embedding chunk ${i} of ${documentId} failed: ` + (err as Error).message);
      }
    }

    if (indexed === 0) throw new Error('Failed to generate embeddings (check Bedrock model access).');
    return { documentId, chunksIndexed: indexed };
  }

  /** Semantic search with GSI-bounded candidate set + in-memory cosine similarity. */
  async search(query: string, category: string | undefined, topK: number, scope: CallerScope) {
    if (scope.isVendor && scope.unresolvedVendor) {
      return { answer: 'Your account is not linked to a vendor profile, so no documents are available to search.', sources: [] };
    }

    // ── Bound the candidate set via GSI (never an unfiltered scan for vendors) ──
    let candidates: any[] = [];
    if (scope.isVendor && scope.vendorId) {
      candidates = await Embedding.query('ownerVendorId').using('embeddingOwnerVendorIndex').eq(scope.vendorId).exec();
      if (category) candidates = candidates.filter((c: any) => c.category === category);
    } else if (category) {
      candidates = await Embedding.query('category').using('embeddingCategoryIndex').eq(category).exec();
    } else {
      // Non-vendor, no category: fall back to a scan (acceptable at this app's
      // document volume — see the scale-limit note in the design doc §7b).
      candidates = await Embedding.scan().exec();
    }

    const rows = candidates.map(toPlain).slice(0, MAX_CANDIDATES);
    if (rows.length === 0) {
      return { answer: 'No indexed documents match your access scope yet. Index some documents first.', sources: [] };
    }

    const queryVector = await invokeEmbedding(query);
    const scored = rows
      .map((r: any) => ({ row: r, score: cosineSimilarity(queryVector, r.embedding || []) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(topK, 20));

    const contextBlocks = scored.map((s, i) => `[${i + 1}] (${s.row.category}) ${s.row.chunkText}`).join('\n\n');
    const system =
      'You are a procurement document assistant. Answer the user\'s question using ONLY the numbered context passages provided. ' +
      'Cite the passage numbers you used like [1], [2]. If the answer is not in the context, say you could not find it in the indexed documents. Be concise.';
    const prompt = `Question: ${query}\n\nContext:\n${contextBlocks}`;

    let answer: string;
    try {
      answer = await invokeText(prompt, system, 1000);
    } catch (err) {
      logger.error('Search RAG generation failed: ' + (err as Error).message);
      answer = 'Found relevant passages but the AI answer is temporarily unavailable. See the source passages below.';
    }

    return {
      answer,
      sources: scored.map(s => ({
        documentId: s.row.documentId,
        chunkText: s.row.chunkText.slice(0, 400),
        score: Math.round(s.score * 1000) / 1000,
        category: s.row.category,
      })),
    };
  }
}

export default new SearchService();
