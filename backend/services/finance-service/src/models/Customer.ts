import * as dynamoose from 'dynamoose';
import { Item } from 'dynamoose/dist/Item';
import { v4 as uuidv4 } from 'uuid';

export interface CustomerDocument extends Item {
  _id: string;
  customerCode: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  gstin?: string;
  pan?: string;
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    zipCode: string;
  };
  billingAddress?: {
    street: string;
    city: string;
    state: string;
    country: string;
    zipCode: string;
  };
  paymentTerms: string;
  creditLimit?: number;
  status: 'active' | 'inactive';
  notes: string;
  website?: string;
  industry?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new dynamoose.Schema(
  {
    _id: {
      type: String,
      hashKey: true,
      default: () => uuidv4(),
    },
    customerCode: {
      type: String,
      required: true,
      index: { name: 'customerCodeIndex', type: 'global' },
    },
    companyName: { type: String, required: true },
    contactPerson: { type: String, required: true },
    email: {
      type: String,
      required: true,
      index: { name: 'customerEmailIndex', type: 'global' },
    },
    phone: { type: String, required: true },
    gstin: { type: String },
    pan: { type: String },
    address: {
      type: Object,
      schema: {
        street:  { type: String, default: '' },
        city:    { type: String, default: '' },
        state:   { type: String, default: '' },
        country: { type: String, default: 'India' },
        zipCode: { type: String, default: '' },
      },
    },
    billingAddress: {
      type: Object,
      schema: {
        street:  { type: String, default: '' },
        city:    { type: String, default: '' },
        state:   { type: String, default: '' },
        country: { type: String, default: 'India' },
        zipCode: { type: String, default: '' },
      },
    },
    paymentTerms: { type: String, default: 'Net 30' },
    creditLimit:  { type: Number },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: { name: 'customerStatusIndex', type: 'global' },
    },
    notes:    { type: String, default: '' },
    website:  { type: String },
    industry: { type: String },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

export const Customer = dynamoose.model<CustomerDocument>('Finance_Customer', customerSchema, {
  create: true,
});
