import * as dynamoose from 'dynamoose';
import { Item } from 'dynamoose/dist/Item';
import { v4 as uuidv4 } from 'uuid';

export interface VendorDocument extends Item {
  _id: string;
  vendorName: string;
  vendorCode: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    zipCode: string;
  };
  taxId: string;
  bankAccount: string;
  status: 'active' | 'inactive' | 'pending' | 'blacklisted';
  rating: number;
  notes: string;
  activities: Array<{
    action: string;
    description: string;
    performedBy: string;
    timestamp: Date;
  }>;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const vendorSchema = new dynamoose.Schema(
  {
    _id: {
      type: String,
      hashKey: true,
      default: () => uuidv4(),
    },
    vendorName: { type: String, required: true },
    vendorCode: {
      type: String,
      required: true,
      index: {
        name: 'vendorCodeIndex',
        type: 'global',
      },
    },
    contactPerson: { type: String, required: true },
    email: {
      type: String,
      required: true,
      index: {
        name: 'vendorEmailIndex',
        type: 'global',
      },
    },
    phone: { type: String, required: true },
    address: {
      type: Object,
      schema: {
        street: { type: String, default: '' },
        city: { type: String, default: '' },
        state: { type: String, default: '' },
        country: { type: String, default: '' },
        zipCode: { type: String, default: '' },
      },
    },
    taxId: { type: String, required: true },
    bankAccount: { type: String, required: true },
    status: {
      type: String,
      enum: ['active', 'inactive', 'pending', 'blacklisted'],
      default: 'pending',
    },
    rating: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    activities: {
      type: Array,
      schema: [
        {
          type: Object,
          schema: {
            action: { type: String, required: true },
            description: { type: String, required: true },
            performedBy: { type: String, required: true },
            timestamp: { type: Date, default: () => new Date() },
          },
        },
      ],
      default: [],
    },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

export const Vendor = dynamoose.model<VendorDocument>('Procurement_Vendor', vendorSchema, {
  create: true,
});
