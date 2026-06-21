import * as dynamoose from 'dynamoose';
import { Item } from 'dynamoose/dist/Item';
import { v4 as uuidv4 } from 'uuid';

export type InvoiceType = 'CUSTOMER_INVOICE' | 'VENDOR_INVOICE';

export interface InvoiceLineItem {
  description: string;
  hsnSacCode?: string;
  quantity: number;
  unit?: string;
  rate: number;
  discount?: number;
  taxableAmount: number;
  gstPercentage: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  totalAmount: number;
}

export interface InvoiceDocument extends Item {
  _id: string;
  invoiceNumber: string;
  invoiceType: InvoiceType;

  // Counterparty
  vendorId?: string;       // for VENDOR_INVOICE
  customerId?: string;     // for CUSTOMER_INVOICE
  partyName: string;       // denormalized display name
  partyGstin?: string;
  partyPan?: string;
  partyAddress?: string;

  // Reference fields
  purchaseOrderId?: string;
  contractId?: string;
  poNumber?: string;

  // Dates
  issueDate: Date;
  dueDate: Date;

  // Place of supply
  placeOfSupply?: string;

  // Line items
  lineItems: InvoiceLineItem[];

  // Tax summary (computed)
  subTotal: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalGst: number;
  gstPercentage?: number;   // overall (if all items same rate)

  // TDS
  tdsPercentage?: number;
  tdsAmount: number;

  // Totals
  grossAmount: number;      // subTotal + totalGst
  companyReceivable: number; // grossAmount (what company receives from client)
  vendorPayable: number;    // grossAmount - tdsAmount (what vendor gets after TDS)
  totalAmount: number;      // same as grossAmount for backward compat

  // Amount in words
  amountInWords?: string;

  // Bank details (for PDF)
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  accountHolder?: string;
  upiId?: string;

  // Status & workflow
  status: 'draft' | 'pending' | 'approved' | 'paid' | 'overdue' | 'disputed' | 'cancelled';
  approvedBy?: string;
  approvedAt?: Date;
  paymentDate?: Date;
  paymentMethod?: string;

  // PDF
  pdfUrl?: string;
  pdfKey?: string;

  // Notes
  description?: string;
  notes?: string;
  termsAndConditions?: string;

  // Legacy fields
  vendor?: string;
  amount?: number;
  tax?: number;

  // Meta
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const lineItemSchema = {
  type: Object,
  schema: {
    description:   { type: String, required: true },
    hsnSacCode:    { type: String },
    quantity:      { type: Number, required: true },
    unit:          { type: String, default: 'Nos' },
    rate:          { type: Number, required: true },
    discount:      { type: Number, default: 0 },
    taxableAmount: { type: Number, required: true },
    gstPercentage: { type: Number, default: 18 },
    cgstAmount:    { type: Number, default: 0 },
    sgstAmount:    { type: Number, default: 0 },
    igstAmount:    { type: Number, default: 0 },
    totalAmount:   { type: Number, required: true },
  },
};

const invoiceSchema = new dynamoose.Schema(
  {
    _id: {
      type: String,
      hashKey: true,
      default: () => uuidv4(),
    },
    invoiceNumber: {
      type: String,
      required: true,
      index: { name: 'invoiceNumberIndex', type: 'global' },
    },
    invoiceType: {
      type: String,
      enum: ['CUSTOMER_INVOICE', 'VENDOR_INVOICE'],
      default: 'VENDOR_INVOICE',
      index: { name: 'invoiceTypeIndex', type: 'global' },
    },

    // Counterparty
    vendorId:     { type: String },
    customerId:   { type: String },
    partyName:    { type: String, required: true },
    partyGstin:   { type: String },
    partyPan:     { type: String },
    partyAddress: { type: String },

    // References
    purchaseOrderId: { type: String },
    contractId:      { type: String },
    poNumber:        { type: String },

    // Dates
    issueDate: { type: Date, default: () => new Date() },
    dueDate:   { type: Date, required: true },

    placeOfSupply: { type: String },

    // Line items
    lineItems: {
      type: Array,
      schema: [lineItemSchema],
      default: [],
    },

    // Tax totals
    subTotal:     { type: Number, default: 0 },
    totalCgst:    { type: Number, default: 0 },
    totalSgst:    { type: Number, default: 0 },
    totalIgst:    { type: Number, default: 0 },
    totalGst:     { type: Number, default: 0 },
    gstPercentage:{ type: Number },

    // TDS
    tdsPercentage: { type: Number, default: 0 },
    tdsAmount:     { type: Number, default: 0 },

    // Computed totals
    grossAmount:       { type: Number, default: 0 },
    companyReceivable: { type: Number, default: 0 },
    vendorPayable:     { type: Number, default: 0 },
    totalAmount:       { type: Number, default: 0 },

    amountInWords: { type: String },

    // Bank details
    bankName:      { type: String },
    accountNumber: { type: String },
    ifscCode:      { type: String },
    accountHolder: { type: String },
    upiId:         { type: String },

    // Backward compat legacy fields
    vendor:  { type: String },  // old field kept for data migration
    amount:  { type: Number, default: 0 },
    tax:     { type: Number, default: 0 },

    // Status
    status: {
      type: String,
      enum: ['draft', 'pending', 'approved', 'paid', 'overdue', 'disputed', 'cancelled'],
      default: 'pending',
      index: { name: 'invoiceStatusIndex', type: 'global' },
    },
    approvedBy:    { type: String },
    approvedAt:    { type: Date },
    paymentDate:   { type: Date },
    paymentMethod: { type: String },

    pdfUrl: { type: String },
    pdfKey: { type: String },

    description:        { type: String, default: '' },
    notes:              { type: String, default: '' },
    termsAndConditions: { type: String },

    createdBy: {
      type: String,
      required: true,
      index: { name: 'invoiceCreatedByIndex', type: 'global' },
    },
  },
  { timestamps: true }
);

export const Invoice = dynamoose.model<InvoiceDocument>('Finance_Invoice', invoiceSchema, {
  create: true,
});
