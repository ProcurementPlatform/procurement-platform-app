import { invokeText, logger } from '@procurement/common';
import { InvoiceAnalysis } from '../models/InvoiceAnalysis';
import { runInvoiceRules, RuleContext } from './rules/invoice-rules';
import { platformData } from './platform-data';

const toPlain = (doc: any) => (doc && typeof doc.toJSON === 'function' ? doc.toJSON() : doc);

export class InvoiceAnalysisService {
  /** Fetch the raw invoice from finance-service (used by the controller for ownership checks). */
  async getInvoice(token: string, invoiceId: string) {
    return platformData.invoice(token, invoiceId);
  }

  /**
   * Run the deterministic rule engine against an invoice, then ask Bedrock to
   * narrate the findings. Bedrock CANNOT change the score/level/findings.
   */
  async analyze(token: string, invoiceId: string, analyzedBy: string) {
    const invoice = await platformData.invoice(token, invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    const allInvoices = await platformData.invoices(token);
    const otherInvoices = allInvoices.filter((i: any) => i._id !== invoiceId);

    const purchaseOrder = invoice.purchaseOrderId ? await platformData.purchaseOrder(token, invoice.purchaseOrderId) : null;
    const contract = invoice.contractId ? await platformData.contract(token, invoice.contractId) : null;

    // Payments are informational (the rules don't use them); best-effort.
    let paymentIds: string[] = [];
    try {
      const payments = await platformData.payments(token);
      paymentIds = payments.filter((p: any) => p.invoice === invoiceId).map((p: any) => p._id);
    } catch (err) {
      logger.warn('Could not load payments for invoice analysis: ' + (err as Error).message);
    }

    // ── Deterministic engine ────────────────────────────────────────────────
    const ctx: RuleContext = { invoice, purchaseOrder, contract, otherInvoices };
    const ruleResult = runInvoiceRules(ctx);

    // ── Bedrock: narrate the findings only ──────────────────────────────────
    let report = '';
    let recommendations: string[] = [];
    try {
      const system =
        'You are a procurement finance audit assistant. You will be given the result of a deterministic invoice-validation rule engine. ' +
        'Write a concise, professional narrative summary for a finance reviewer and 2-4 specific, actionable recommendations. ' +
        'Do NOT invent additional findings and do NOT change the risk score. ' +
        'Respond ONLY with valid minified JSON of the form {"report": string, "recommendations": string[]}.';
      const prompt = JSON.stringify({
        invoiceNumber: invoice.invoiceNumber,
        riskScore: ruleResult.riskScore,
        riskLevel: ruleResult.riskLevel,
        findings: ruleResult.findings,
      });
      const raw = await invokeText(prompt, system, 800);
      const parsed = this.safeParseJson(raw);
      report = typeof parsed?.report === 'string' ? parsed.report : raw;
      recommendations = Array.isArray(parsed?.recommendations) ? parsed.recommendations.map(String) : [];
    } catch (err) {
      logger.error('Bedrock narrative generation failed for invoice analysis: ' + (err as Error).message);
      report = ruleResult.findings.length
        ? `Automated rule checks flagged ${ruleResult.findings.length} issue(s); AI narrative is temporarily unavailable.`
        : 'No issues detected by the automated rule checks. AI narrative is temporarily unavailable.';
      recommendations = [];
    }

    const created = await InvoiceAnalysis.create({
      invoiceId,
      riskScore: ruleResult.riskScore,
      riskLevel: ruleResult.riskLevel,
      findings: ruleResult.findings,
      report,
      recommendations,
      ruleEngineVersion: ruleResult.ruleEngineVersion,
      crossCheckedAgainst: {
        purchaseOrderId: invoice.purchaseOrderId,
        contractId: invoice.contractId,
        paymentIds,
      },
      analyzedBy,
    });
    return toPlain(created);
  }

  /** Most recent analysis row for an invoice (or null). */
  async getLatest(invoiceId: string) {
    const rows = await InvoiceAnalysis.query('invoiceId')
      .using('invoiceAnalysisInvoiceIdIndex')
      .eq(invoiceId)
      .exec();
    if (!rows.length) return null;
    return rows
      .map(toPlain)
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }

  private safeParseJson(raw: string): any {
    try {
      return JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) { try { return JSON.parse(match[0]); } catch { /* ignore */ } }
      return null;
    }
  }
}

export default new InvoiceAnalysisService();
