import * as dynamoose from 'dynamoose';
import { Item } from 'dynamoose/dist/Item';
import { v4 as uuidv4 } from 'uuid';

export interface ContractDocument extends Item {
  _id: string;
  contractName: string;
  vendor: string;
  contractNumber: string;
  effectiveDate: Date;
  expiryDate: Date;
  contractValue: number;
  status: 'active' | 'expired' | 'terminated' | 'pending_renewal';
  description: string;
  documentUrl?: string;
  versions: Array<{
    version: number;
    documentUrl: string;
    uploadedAt: Date;
    uploadedBy: string;
  }>;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const contractSchema = new dynamoose.Schema(
  {
    _id: {
      type: String,
      hashKey: true,
      default: () => uuidv4(),
    },
    contractName: { type: String, required: true },
    vendor: {
      type: String,
      required: true,
      index: {
        name: 'contractVendorIndex',
        type: 'global',
      },
    },
    contractNumber: {
      type: String,
      required: true,
      index: {
        name: 'contractNumberIndex',
        type: 'global',
      },
    },
    effectiveDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
    contractValue: { type: Number, required: true },
    status: {
      type: String,
      enum: ['active', 'expired', 'terminated', 'pending_renewal'],
      default: 'active',
      index: {
        name: 'contractStatusIndex',
        type: 'global',
      },
    },
    description: { type: String, default: '' },
    documentUrl: { type: String },
    versions: {
      type: Array,
      schema: [
        {
          type: Object,
          schema: {
            version: { type: Number, required: true },
            documentUrl: { type: String, required: true },
            uploadedAt: { type: Date, default: () => new Date() },
            uploadedBy: { type: String, required: true },
          },
        },
      ],
      default: [],
    },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

export const Contract = dynamoose.model<ContractDocument>('Procurement_Contract', contractSchema, {
  create: true,
});
