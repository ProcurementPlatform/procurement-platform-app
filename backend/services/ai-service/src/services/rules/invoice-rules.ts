// Deterministic invoice-validation rule engine.
//
// This file contains ONLY pure functions — no DynamoDB, no Bedrock, no I/O.
// The service layer fetches the data and passes plain objects in; the rules
// compute findings + a risk score deterministically. Bedrock is used elsewhere
// strictly to narrate these findings, never to detect or score them.

export const RULE_ENGINE_VERSION = 'v1';

export type InvoiceFindingType =
  | 'duplicate'
  | 'missing_reference'
  | 'amount_mismatch'
  | 'overbilling'
  | 'contract_violation'
  | 'other';
export type FindingSeverity = 'low' | 'medium' | 'high';
export type InvoiceRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface Finding {
  findingType: InvoiceFindingType;
  severity: FindingSeverity;
  description: string;
  relatedEntityId?: string;
}

// Minimal structural shapes (so the rules don't depend on Dynamoose types).
export interface InvoiceLike {
  _id: string;
  invoiceNumber?: string;
  invoiceType?: string;
  vendorId?: string;
  customerId?: string;
  partyName?: string;
  purchaseOrderId?: string;
  contractId?: string;
  issueDate?: string | Date;
  totalAmount?: number;
  grossAmount?: number;
}
export interface POLike {
  _id: string;
  poNumber?: string;
  totalAmount?: number;
}
export interface ContractLike {
  _id: string;
  contractNumber?: string;
  contractValue?: number;
  effectiveDate?: string | Date;
  expiryDate?: string | Date;
}

export interface RuleContext {
  invoice: InvoiceLike;
  purchaseOrder?: POLike | null;
  contract?: ContractLike | null;
  otherInvoices: InvoiceLike[]; // every other invoice in the system (excluding this one)
}

const SEVERITY_WEIGHT: Record<FindingSeverity, number> = { low: 10, medium: 25, high: 45 };
const AMOUNT_TOLERANCE = 0.05; // 5% — below this an amount gap is not flagged
const DUPLICATE_DAY_WINDOW = 3;

const amountOf = (inv: { totalAmount?: number; grossAmount?: number }): number =>
  inv.totalAmount ?? inv.grossAmount ?? 0;

const toTime = (d?: string | Date): number => (d ? new Date(d).getTime() : NaN);

const daysBetween = (a?: string | Date, b?: string | Date): number =>
  Math.abs(toTime(a) - toTime(b)) / 86_400_000;

/** Rule 1 — duplicate invoice: same counterparty + same amount within a few days. */
export const checkDuplicate = (ctx: RuleContext): Finding[] => {
  const { invoice, otherInvoices } = ctx;
  const amt = amountOf(invoice);
  const party = invoice.vendorId || invoice.customerId;
  const findings: Finding[] = [];

  for (const other of otherInvoices) {
    const sameParty = party && (other.vendorId === party || other.customerId === party);
    const sameAmount = Math.abs(amountOf(other) - amt) < 0.01 && amt > 0;
    const closeInTime = daysBetween(invoice.issueDate, other.issueDate) <= DUPLICATE_DAY_WINDOW;
    if (sameParty && sameAmount && closeInTime) {
      findings.push({
        findingType: 'duplicate',
        severity: 'high',
        description: `Possible duplicate of invoice ${other.invoiceNumber || other._id} — same party and amount (${amt}) within ${DUPLICATE_DAY_WINDOW} days.`,
        relatedEntityId: other._id,
      });
    }
  }
  return findings;
};

/** Rule 2 — missing PO reference on a vendor (payable) invoice. */
export const checkMissingReference = (ctx: RuleContext): Finding[] => {
  const { invoice } = ctx;
  if (invoice.invoiceType === 'VENDOR_INVOICE' && !invoice.purchaseOrderId) {
    return [{
      findingType: 'missing_reference',
      severity: 'medium',
      description: 'Vendor invoice has no linked purchase order, so it cannot be matched against an approved order.',
    }];
  }
  return [];
};

/** Rule 3 — invoice total deviates from the linked PO total. */
export const checkAmountMismatch = (ctx: RuleContext): Finding[] => {
  const { invoice, purchaseOrder } = ctx;
  if (!purchaseOrder) return [];
  const invAmt = amountOf(invoice);
  const poAmt = purchaseOrder.totalAmount ?? 0;
  if (poAmt <= 0) return [];
  const diff = Math.abs(invAmt - poAmt);
  const pct = diff / poAmt;
  if (pct > AMOUNT_TOLERANCE) {
    const severity: FindingSeverity = pct > 0.25 ? 'high' : pct > 0.1 ? 'medium' : 'low';
    return [{
      findingType: 'amount_mismatch',
      severity,
      description: `Invoice total (${invAmt}) differs from PO ${purchaseOrder.poNumber || purchaseOrder._id} total (${poAmt}) by ${(pct * 100).toFixed(1)}%.`,
      relatedEntityId: purchaseOrder._id,
    }];
  }
  return [];
};

/** Rule 4 — cumulative invoicing against a PO exceeds the PO total. */
export const checkOverbilling = (ctx: RuleContext): Finding[] => {
  const { invoice, purchaseOrder, otherInvoices } = ctx;
  if (!purchaseOrder || !invoice.purchaseOrderId) return [];
  const poAmt = purchaseOrder.totalAmount ?? 0;
  if (poAmt <= 0) return [];
  const otherAgainstPo = otherInvoices
    .filter(o => o.purchaseOrderId === invoice.purchaseOrderId)
    .reduce((sum, o) => sum + amountOf(o), 0);
  const cumulative = otherAgainstPo + amountOf(invoice);
  if (cumulative > poAmt * (1 + AMOUNT_TOLERANCE)) {
    return [{
      findingType: 'overbilling',
      severity: 'high',
      description: `Cumulative invoicing against PO ${purchaseOrder.poNumber || purchaseOrder._id} (${cumulative}) exceeds the PO total (${poAmt}).`,
      relatedEntityId: purchaseOrder._id,
    }];
  }
  return [];
};

/** Rule 5 — invoice violates its linked contract (out of term, or over value). */
export const checkContractViolation = (ctx: RuleContext): Finding[] => {
  const { invoice, contract, otherInvoices } = ctx;
  if (!contract || !invoice.contractId) return [];
  const findings: Finding[] = [];

  const issued = toTime(invoice.issueDate);
  const eff = toTime(contract.effectiveDate);
  const exp = toTime(contract.expiryDate);
  if (!Number.isNaN(issued) && !Number.isNaN(eff) && !Number.isNaN(exp) && (issued < eff || issued > exp)) {
    findings.push({
      findingType: 'contract_violation',
      severity: 'high',
      description: `Invoice issue date falls outside contract ${contract.contractNumber || contract._id} term (${new Date(eff).toISOString().slice(0, 10)} – ${new Date(exp).toISOString().slice(0, 10)}).`,
      relatedEntityId: contract._id,
    });
  }

  const contractValue = contract.contractValue ?? 0;
  if (contractValue > 0) {
    const otherAgainstContract = otherInvoices
      .filter(o => o.contractId === invoice.contractId)
      .reduce((sum, o) => sum + amountOf(o), 0);
    const cumulative = otherAgainstContract + amountOf(invoice);
    if (cumulative > contractValue * (1 + AMOUNT_TOLERANCE)) {
      findings.push({
        findingType: 'contract_violation',
        severity: 'high',
        description: `Cumulative invoicing against contract ${contract.contractNumber || contract._id} (${cumulative}) exceeds its value (${contractValue}).`,
        relatedEntityId: contract._id,
      });
    }
  }
  return findings;
};

const levelForScore = (score: number): InvoiceRiskLevel =>
  score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low';

export interface RuleResult {
  findings: Finding[];
  riskScore: number;
  riskLevel: InvoiceRiskLevel;
  ruleEngineVersion: string;
}

/** Run all rules and compute a deterministic score + level. */
export const runInvoiceRules = (ctx: RuleContext): RuleResult => {
  const findings: Finding[] = [
    ...checkDuplicate(ctx),
    ...checkMissingReference(ctx),
    ...checkAmountMismatch(ctx),
    ...checkOverbilling(ctx),
    ...checkContractViolation(ctx),
  ];

  const riskScore = Math.min(
    100,
    findings.reduce((sum, f) => sum + SEVERITY_WEIGHT[f.severity], 0)
  );

  return {
    findings,
    riskScore,
    riskLevel: levelForScore(riskScore),
    ruleEngineVersion: RULE_ENGINE_VERSION,
  };
};
