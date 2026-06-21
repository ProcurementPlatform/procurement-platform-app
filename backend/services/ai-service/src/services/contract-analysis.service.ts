import { invokeText, logger } from '@procurement/common';
import { ContractAnalysis } from '../models/ContractAnalysis';
import { extractText } from './document-text';
import { platformData, fetchFileBuffer } from './platform-data';

const toPlain = (doc: any) => (doc && typeof doc.toJSON === 'function' ? doc.toJSON() : doc);
const MAX_CHARS = 24000; // bound the prompt — first ~24k chars cover most contracts' key terms

export class ContractAnalysisService {
  /**
   * Extract structured contract metadata + a summary + renewal-risk assessment
   * from an already-uploaded contract document using Bedrock. The file is pulled
   * from document-service's presigned URL (no direct S3 access here).
   */
  async analyze(token: string, documentId: string, analyzedBy: string) {
    const dl = await platformData.documentDownload(token, documentId);
    const doc = dl?.document;
    if (!doc) throw new Error('Document not found');
    if (doc.category !== 'contract') throw new Error('This document is not categorised as a contract.');

    let text: string | null = null;
    let reason: string | undefined;
    try {
      const buffer = await fetchFileBuffer(dl.url);
      ({ text, reason } = await extractText(buffer, doc.mimeType, doc.originalName));
    } catch (err) {
      reason = 'Could not download the document file.';
      logger.error('Contract file download failed: ' + (err as Error).message);
    }

    if (!text) {
      // Persist a failed analysis so the UI can show a clear reason.
      const failed = await ContractAnalysis.create({
        documentId,
        summary: reason || 'Could not extract text from this document.',
        renewalRisk: { riskLevel: 'low', reasoning: 'Not assessed — text extraction failed.' },
        analyzedBy,
        status: 'failed',
      });
      return toPlain(failed);
    }

    const system =
      'You are a contracts analyst. Extract structured metadata from the contract text and assess renewal risk. ' +
      'Respond ONLY with valid minified JSON of this exact shape: ' +
      '{"vendorName":string,"contractNumber":string,"contractValue":number|null,"effectiveDate":string|null,"expiryDate":string|null,' +
      '"keyTerms":[{"label":string,"value":string}],"clauses":[{"clauseType":string,"summary":string,"riskLevel":"low"|"medium"|"high"}],' +
      '"summary":string,"renewalRisk":{"riskLevel":"low"|"medium"|"high","reasoning":string}}. ' +
      'Dates must be ISO (YYYY-MM-DD) or null. Identify payment terms, renewal terms, penalty clauses, and termination clauses among the clauses. ' +
      'Do not include any text outside the JSON.';

    let raw = '';
    let parsed: any = null;
    try {
      raw = await invokeText(text.slice(0, MAX_CHARS), system, 2000);
      parsed = this.safeParseJson(raw);
    } catch (err) {
      logger.error('Bedrock contract analysis failed: ' + (err as Error).message);
    }

    if (!parsed) {
      const failed = await ContractAnalysis.create({
        documentId,
        summary: 'The AI analysis could not be completed. Please try again.',
        rawModelOutput: raw,
        renewalRisk: { riskLevel: 'low', reasoning: 'Not assessed — AI analysis unavailable.' },
        analyzedBy,
        status: 'failed',
      });
      return toPlain(failed);
    }

    const expiry = this.parseDate(parsed.expiryDate);
    const daysToExpiry = expiry ? Math.round((expiry.getTime() - Date.now()) / 86400000) : undefined;

    const created = await ContractAnalysis.create({
      documentId,
      vendorName: String(parsed.vendorName || ''),
      contractNumber: String(parsed.contractNumber || ''),
      contractValue: typeof parsed.contractValue === 'number' ? parsed.contractValue : undefined,
      effectiveDate: this.parseDate(parsed.effectiveDate) || undefined,
      expiryDate: expiry || undefined,
      keyTerms: Array.isArray(parsed.keyTerms) ? parsed.keyTerms.filter((t: any) => t?.label && t?.value).map((t: any) => ({ label: String(t.label), value: String(t.value) })) : [],
      clauses: Array.isArray(parsed.clauses) ? parsed.clauses.filter((c: any) => c?.clauseType && c?.summary).map((c: any) => ({ clauseType: String(c.clauseType), summary: String(c.summary), riskLevel: ['low', 'medium', 'high'].includes(c.riskLevel) ? c.riskLevel : 'low' })) : [],
      summary: String(parsed.summary || ''),
      renewalRisk: {
        riskLevel: ['low', 'medium', 'high'].includes(parsed.renewalRisk?.riskLevel) ? parsed.renewalRisk.riskLevel : 'low',
        reasoning: String(parsed.renewalRisk?.reasoning || ''),
        daysToExpiry,
      },
      rawModelOutput: raw,
      analyzedBy,
      status: 'completed',
    });
    return toPlain(created);
  }

  async getLatest(documentId: string) {
    const rows = await ContractAnalysis.query('documentId')
      .using('contractAnalysisDocumentIdIndex')
      .eq(documentId)
      .exec();
    if (!rows.length) return null;
    return rows
      .map(toPlain)
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }

  private parseDate(v: any): Date | null {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  private safeParseJson(raw: string): any {
    try { return JSON.parse(raw); } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) { try { return JSON.parse(match[0]); } catch { /* ignore */ } }
      return null;
    }
  }
}

export default new ContractAnalysisService();
