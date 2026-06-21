import * as dynamoose from 'dynamoose';
import { Item } from 'dynamoose/dist/Item';
import { v4 as uuidv4 } from 'uuid';
import { PaymentMethod, PaymentStatus } from '@procurement/types';

export interface PaymentDocument extends Item {
  _id: string;
  paymentReference: string;
  invoice: string;
  vendor: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate: Date;
  status: PaymentStatus;
  notes: string;
  processedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new dynamoose.Schema(
  {
    _id: {
      type: String,
      hashKey: true,
      default: () => uuidv4(),
    },
    paymentReference: {
      type: String,
      required: true,
      index: {
        name: 'paymentRefIndex',
        type: 'global',
      },
    },
    invoice: {
      type: String,
      required: true,
      index: {
        name: 'paymentInvoiceIndex',
        type: 'global',
      },
    },
    vendor: {
      type: String,
      required: true,
      index: {
        name: 'paymentVendorIndex',
        type: 'global',
      },
    },
    amount: { type: Number, required: true },
    paymentMethod: {
      type: String,
      enum: ['wire_transfer', 'check', 'ach', 'credit_card'],
      required: true,
    },
    paymentDate: { type: Date, default: () => new Date() },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'reversed'],
      default: 'completed',
      index: {
        name: 'paymentStatusIndex',
        type: 'global',
      },
    },
    notes: { type: String, default: '' },
    processedBy: { type: String, required: true },
  },
  { timestamps: true }
);

export const Payment = dynamoose.model<PaymentDocument>('Finance_Payment', paymentSchema, {
  create: true,
});
