import * as dynamoose from 'dynamoose';
import { Item } from 'dynamoose/dist/Item';
import { v4 as uuidv4 } from 'uuid';

export type InvoiceFindingType =
  | 'duplicate'
  | 'missing_reference'
  | 'amount_mismatch'
  | 'overbilling'
  | 'contract_violation'
  | 'other';

export type FindingSeverity = 'low' | 'medium' | 'high';
export type InvoiceRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface InvoiceFinding {
  findingType: InvoiceFindingType;
  severity: FindingSeverity;
  description: string;
  relatedEntityId?: string;
}

export interface InvoiceAnalysisDocument extends Item {
  _id: string;
  invoiceId: string;
  riskScore: number;
  riskLevel: InvoiceRiskLevel;
  findings: InvoiceFinding[];
  report: string;
  recommendations: string[];
  ruleEngineVersion: string;
  crossCheckedAgainst: {
    purchaseOrderId?: string;
    contractId?: string;
    paymentIds: string[];
  };
  analyzedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const invoiceAnalysisSchema = new dynamoose.Schema(
  {
    _id: {
      type: String,
      hashKey: true,
      default: () => uuidv4(),
    },
    invoiceId: {
      type: String,
      required: true,
      index: { name: 'invoiceAnalysisInvoiceIdIndex', type: 'global' },
    },
    riskScore: { type: Number, required: true },
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'low',
      index: { name: 'invoiceAnalysisRiskLevelIndex', type: 'global' },
    },
    findings: {
      type: Array,
      schema: [
        {
          type: Object,
          schema: {
            findingType: {
              type: String,
              enum: ['duplicate', 'missing_reference', 'amount_mismatch', 'overbilling', 'contract_violation', 'other'],
              required: true,
            },
            severity: { type: String, enum: ['low', 'medium', 'high'], required: true },
            description: { type: String, required: true },
            relatedEntityId: { type: String },
          },
        },
      ],
      default: [],
    },
    report: { type: String, default: '' },
    recommendations: {
      type: Array,
      schema: [String],
      default: [],
    },
    ruleEngineVersion: { type: String, default: 'v1' },
    crossCheckedAgainst: {
      type: Object,
      schema: {
        purchaseOrderId: { type: String },
        contractId: { type: String },
        paymentIds: { type: Array, schema: [String], default: [] },
      },
    },
    analyzedBy: { type: String, required: true },
  },
  { timestamps: true }
);

export const InvoiceAnalysis = dynamoose.model<InvoiceAnalysisDocument>(
  'AI_InvoiceAnalysis',
  invoiceAnalysisSchema,
  { create: true }
);
