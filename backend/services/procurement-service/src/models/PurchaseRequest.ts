import * as dynamoose from 'dynamoose';
import { Item } from 'dynamoose/dist/Item';
import { v4 as uuidv4 } from 'uuid';

export interface PurchaseRequestDocument extends Item {
  _id: string;
  title: string;
  department: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  description: string;
  estimatedCost: number;
  vendor?: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  requestedBy: string;
  approvedBy?: string;
  rejectionReason?: string;
  items: Array<{
    name: string;
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const purchaseRequestSchema = new dynamoose.Schema(
  {
    _id: {
      type: String,
      hashKey: true,
      default: () => uuidv4(),
    },
    title: { type: String, required: true },
    department: { type: String, required: true },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    description: { type: String, required: true },
    estimatedCost: { type: Number, required: true },
    vendor: {
      type: String,
      index: {
        name: 'prVendorIndex',
        type: 'global',
      },
    },
    status: {
      type: String,
      enum: ['draft', 'pending', 'approved', 'rejected'],
      default: 'draft',
      index: {
        name: 'prStatusIndex',
        type: 'global',
      },
    },
    requestedBy: {
      type: String,
      required: true,
      index: {
        name: 'prRequestedByIndex',
        type: 'global',
      },
    },
    approvedBy: { type: String },
    rejectionReason: { type: String },
    items: {
      type: Array,
      schema: [
        {
          type: Object,
          schema: {
            name: { type: String, required: true },
            description: { type: String, default: '' },
            quantity: { type: Number, required: true },
            unitPrice: { type: Number, required: true },
          },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

export const PurchaseRequest = dynamoose.model<PurchaseRequestDocument>(
  'Procurement_PurchaseRequest',
  purchaseRequestSchema,
  { create: true }
);
