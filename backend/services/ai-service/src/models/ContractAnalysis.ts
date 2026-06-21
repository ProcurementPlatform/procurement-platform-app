import * as dynamoose from 'dynamoose';
import { Item } from 'dynamoose/dist/Item';
import { v4 as uuidv4 } from 'uuid';

export type ClauseRisk = 'low' | 'medium' | 'high';

export interface ContractKeyTerm {
  label: string;
  value: string;
}
export interface ContractClause {
  clauseType: string;
  summary: string;
  riskLevel: ClauseRisk;
}

export interface ContractAnalysisDocument extends Item {
  _id: string;
  documentId: string;
  vendorName: string;
  contractNumber: string;
  contractValue?: number;
  effectiveDate?: Date;
  expiryDate?: Date;
  keyTerms: ContractKeyTerm[];
  clauses: ContractClause[];
  summary: string;
  renewalRisk: {
    riskLevel: ClauseRisk;
    reasoning: string;
    daysToExpiry?: number;
  };
  rawModelOutput?: string;
  analyzedBy: string;
  status: 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

const contractAnalysisSchema = new dynamoose.Schema(
  {
    _id: { type: String, hashKey: true, default: () => uuidv4() },
    documentId: {
      type: String,
      required: true,
      index: { name: 'contractAnalysisDocumentIdIndex', type: 'global' },
    },
    vendorName: { type: String, default: '' },
    contractNumber: { type: String, default: '' },
    contractValue: { type: Number },
    effectiveDate: { type: Date },
    expiryDate: { type: Date },
    keyTerms: {
      type: Array,
      schema: [{ type: Object, schema: { label: { type: String, required: true }, value: { type: String, required: true } } }],
      default: [],
    },
    clauses: {
      type: Array,
      schema: [
        {
          type: Object,
          schema: {
            clauseType: { type: String, required: true },
            summary: { type: String, required: true },
            riskLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
          },
        },
      ],
      default: [],
    },
    summary: { type: String, default: '' },
    renewalRisk: {
      type: Object,
      schema: {
        riskLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
        reasoning: { type: String, default: '' },
        daysToExpiry: { type: Number },
      },
    },
    rawModelOutput: { type: String },
    analyzedBy: { type: String, required: true },
    status: {
      type: String,
      enum: ['completed', 'failed'],
      default: 'completed',
      index: { name: 'contractAnalysisStatusIndex', type: 'global' },
    },
  },
  { timestamps: true }
);

export const ContractAnalysis = dynamoose.model<ContractAnalysisDocument>(
  'AI_ContractAnalysis',
  contractAnalysisSchema,
  { create: true }
);
