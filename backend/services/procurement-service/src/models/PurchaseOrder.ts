import * as dynamoose from 'dynamoose';
import { Item } from 'dynamoose/dist/Item';
import { v4 as uuidv4 } from 'uuid';

export interface PurchaseOrderDocument extends Item {
  _id: string;
  poNumber: string;
  vendor: string;
  purchaseRequest?: string;
  items: Array<{
    name: string;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  subtotal: number;
  tax: number;
  totalAmount: number;
  status: 'draft' | 'issued' | 'acknowledged' | 'shipped' | 'completed' | 'cancelled';
  orderDate: Date;
  expectedDeliveryDate?: Date;
  notes: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const purchaseOrderSchema = new dynamoose.Schema(
  {
    _id: {
      type: String,
      hashKey: true,
      default: () => uuidv4(),
    },
    poNumber: {
      type: String,
      required: true,
      index: {
        name: 'poNumberIndex',
        type: 'global',
      },
    },
    vendor: {
      type: String,
      required: true,
      index: {
        name: 'poVendorIndex',
        type: 'global',
      },
    },
    purchaseRequest: { type: String },
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
            totalPrice: { type: Number, required: true },
          },
        },
      ],
      default: [],
    },
    subtotal: { type: Number, required: true },
    tax: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['draft', 'issued', 'acknowledged', 'shipped', 'completed', 'cancelled'],
      default: 'draft',
      index: {
        name: 'poStatusIndex',
        type: 'global',
      },
    },
    orderDate: { type: Date, default: () => new Date() },
    expectedDeliveryDate: { type: Date },
    notes: { type: String, default: '' },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

export const PurchaseOrder = dynamoose.model<PurchaseOrderDocument>(
  'Procurement_PurchaseOrder',
  purchaseOrderSchema,
  { create: true }
);
